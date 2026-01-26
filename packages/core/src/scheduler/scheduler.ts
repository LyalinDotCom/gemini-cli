/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { SchedulerStateManager } from './state-manager.js';
import { resolveConfirmation } from './confirmation.js';
import { checkPolicy, updatePolicy } from './policy.js';
import { ToolExecutor } from './tool-executor.js';
import { ToolModificationHandler } from './tool-modifier.js';
import {
  type ToolCallRequestInfo,
  type ToolCall,
  type ToolCallResponseInfo,
  type CompletedToolCall,
  type ExecutingToolCall,
  type ValidatingToolCall,
  type ErroredToolCall,
} from './types.js';
import { ToolErrorType } from '../tools/tool-error.js';
import { PolicyDecision, ApprovalMode } from '../policy/types.js';
import {
  ToolConfirmationOutcome,
  type AnyDeclarativeTool,
  Kind,
} from '../tools/tools.js';
import { getToolSuggestion } from '../utils/tool-utils.js';
import { runInDevTraceSpan } from '../telemetry/trace.js';
import { logToolCall } from '../telemetry/loggers.js';
import { ToolCallEvent } from '../telemetry/types.js';
import type { EditorType } from '../utils/editor.js';
import {
  MessageBusType,
  type SerializableConfirmationDetails,
  type ToolConfirmationRequest,
} from '../confirmation-bus/types.js';

interface SchedulerQueueItem {
  requests: ToolCallRequestInfo[];
  signal: AbortSignal;
  resolve: (results: CompletedToolCall[]) => void;
  reject: (reason?: Error) => void;
}

export interface SchedulerOptions {
  config: Config;
  messageBus: MessageBus;
  getPreferredEditor: () => EditorType | undefined;
}

const createErrorResponse = (
  request: ToolCallRequestInfo,
  error: Error,
  errorType: ToolErrorType | undefined,
): ToolCallResponseInfo => ({
  callId: request.callId,
  error,
  responseParts: [
    {
      functionResponse: {
        id: request.callId,
        name: request.name,
        response: { error: error.message },
      },
    },
  ],
  resultDisplay: error.message,
  errorType,
  contentLength: error.message.length,
});
const HINT_DEBOUNCE_MS = 400;
const PLAN_MODE_DENIAL_MESSAGE =
  'You are in Plan Mode - adjust your prompt to only use read and search tools.';

/**
 * Event-Driven Orchestrator for Tool Execution.
 * Coordinates execution via state updates and event listening.
 */
export class Scheduler {
  // Tracks which MessageBus instances have the legacy listener attached to prevent duplicates.
  private static subscribedMessageBuses = new WeakSet<MessageBus>();

  private readonly state: SchedulerStateManager;
  private readonly executor: ToolExecutor;
  private readonly modifier: ToolModificationHandler;
  private readonly config: Config;
  private readonly messageBus: MessageBus;
  private readonly getPreferredEditor: () => EditorType | undefined;

  private isProcessing = false;
  private isCancelling = false;
  private readonly requestQueue: SchedulerQueueItem[] = [];

  constructor(options: SchedulerOptions) {
    this.config = options.config;
    this.messageBus = options.messageBus;
    this.getPreferredEditor = options.getPreferredEditor;
    this.state = new SchedulerStateManager(this.messageBus);
    this.executor = new ToolExecutor(this.config);
    this.modifier = new ToolModificationHandler();

    this.setupMessageBusListener(this.messageBus);
  }

  private setupMessageBusListener(messageBus: MessageBus): void {
    if (Scheduler.subscribedMessageBuses.has(messageBus)) {
      return;
    }

    // TODO: Optimize policy checks. Currently, tools check policy via
    // MessageBus even though the Scheduler already checked it.
    messageBus.subscribe(
      MessageBusType.TOOL_CONFIRMATION_REQUEST,
      async (request: ToolConfirmationRequest) => {
        await messageBus.publish({
          type: MessageBusType.TOOL_CONFIRMATION_RESPONSE,
          correlationId: request.correlationId,
          confirmed: false,
          requiresUserConfirmation: true,
        });
      },
    );

    Scheduler.subscribedMessageBuses.add(messageBus);
  }

  /**
   * Schedules a batch of tool calls.
   * @returns A promise that resolves with the results of the completed batch.
   */
  async schedule(
    request: ToolCallRequestInfo | ToolCallRequestInfo[],
    signal: AbortSignal,
  ): Promise<CompletedToolCall[]> {
    return runInDevTraceSpan(
      { name: 'schedule' },
      async ({ metadata: spanMetadata }) => {
        const requests = Array.isArray(request) ? request : [request];
        spanMetadata.input = requests;

        if (this.isProcessing || this.state.isActive) {
          return this._enqueueRequest(requests, signal);
        }

        return this._startBatch(requests, signal);
      },
    );
  }

  private _enqueueRequest(
    requests: ToolCallRequestInfo[],
    signal: AbortSignal,
  ): Promise<CompletedToolCall[]> {
    return new Promise<CompletedToolCall[]>((resolve, reject) => {
      const abortHandler = () => {
        const index = this.requestQueue.findIndex(
          (item) => item.requests === requests,
        );
        if (index > -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Tool call cancelled while in queue.'));
        }
      };

      if (signal.aborted) {
        reject(new Error('Operation cancelled'));
        return;
      }

      signal.addEventListener('abort', abortHandler, { once: true });

      this.requestQueue.push({
        requests,
        signal,
        resolve: (results) => {
          signal.removeEventListener('abort', abortHandler);
          resolve(results);
        },
        reject: (err) => {
          signal.removeEventListener('abort', abortHandler);
          reject(err);
        },
      });
    });
  }

  cancelAll(): void {
    if (this.isCancelling) return;
    this.isCancelling = true;

    // Clear scheduler request queue
    while (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      next?.reject(new Error('Operation cancelled by user'));
    }

    // Cancel active call
    const activeCalls = this.state.getActiveCalls();
    for (const activeCall of activeCalls) {
      if (!this.isTerminal(activeCall.status)) {
        this.state.updateStatus(
          activeCall.request.callId,
          'cancelled',
          'Operation cancelled by user',
        );
      }
    }

    // Clear queue
    this.state.cancelAllQueued('Operation cancelled by user');
  }

  get completedCalls(): CompletedToolCall[] {
    return this.state.completedBatch;
  }

  private isTerminal(status: string) {
    return status === 'success' || status === 'error' || status === 'cancelled';
  }

  private isParallelizable(call: ToolCall): boolean {
    if (!('tool' in call) || !call.tool) {
      return false;
    }
    return (
      call.tool.kind === Kind.Read ||
      call.tool.kind === Kind.Search ||
      call.tool.kind === Kind.Fetch ||
      call.tool.kind === Kind.Think
    );
  }

  // --- Phase 1: Ingestion & Resolution ---

  private async _startBatch(
    requests: ToolCallRequestInfo[],
    signal: AbortSignal,
  ): Promise<CompletedToolCall[]> {
    this.isProcessing = true;
    this.isCancelling = false;
    this.state.clearBatch();

    try {
      const toolRegistry = this.config.getToolRegistry();
      const newCalls: ToolCall[] = requests.map((request) => {
        const tool = toolRegistry.getTool(request.name);

        if (!tool) {
          return this._createToolNotFoundErroredToolCall(
            request,
            toolRegistry.getAllToolNames(),
          );
        }

        return this._validateAndCreateToolCall(request, tool);
      });

      this.state.enqueue(newCalls);
      await this._processQueue(signal);
      return this.state.completedBatch;
    } finally {
      this.isProcessing = false;
      this._processNextInRequestQueue();
    }
  }

  private _createToolNotFoundErroredToolCall(
    request: ToolCallRequestInfo,
    toolNames: string[],
  ): ErroredToolCall {
    const suggestion = getToolSuggestion(request.name, toolNames);
    return {
      status: 'error',
      request,
      response: createErrorResponse(
        request,
        new Error(`Tool "${request.name}" not found.${suggestion}`),
        ToolErrorType.TOOL_NOT_REGISTERED,
      ),
      durationMs: 0,
    };
  }

  private _validateAndCreateToolCall(
    request: ToolCallRequestInfo,
    tool: AnyDeclarativeTool,
  ): ValidatingToolCall | ErroredToolCall {
    try {
      const invocation = tool.build(request.args);
      return {
        status: 'validating',
        request,
        tool,
        invocation,
        startTime: Date.now(),
      };
    } catch (e) {
      return {
        status: 'error',
        request,
        tool,
        response: createErrorResponse(
          request,
          e instanceof Error ? e : new Error(String(e)),
          ToolErrorType.INVALID_TOOL_PARAMS,
        ),
        durationMs: 0,
      };
    }
  }

  // --- Phase 2: Processing Loop ---

  private async _processQueue(signal: AbortSignal): Promise<void> {
    while (this.state.queueLength > 0 || this.state.isActive) {
      const shouldContinue = await this._processNextItem(signal);
      if (!shouldContinue) break;
    }
  }

  /**
   * Processes the next item in the queue.
   * @returns true if the loop should continue, false if it should terminate.
   */
  private async _processNextItem(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted || this.isCancelling) {
      this.state.cancelAllQueued('Operation cancelled');
      return false;
    }

    if (!this.state.isActive) {
      await this.maybeDelayForHint(signal);

      const batch = this.state.dequeueBatch((call) =>
        this.isParallelizable(call),
      );
      if (batch.length === 0) return false;

      for (const call of batch) {
        if (call.status === 'error') {
          this.state.updateStatus(call.request.callId, 'error', call.response);
          this.state.finalizeCall(call.request.callId);
        }
      }
    }

    const activeCalls = this.state.getActiveCalls();
    if (activeCalls.length === 0) {
      return this.state.queueLength > 0;
    }

    const validatingCalls = activeCalls.filter(
      (call): call is ValidatingToolCall => call.status === 'validating',
    );

    if (validatingCalls.length === 0) {
      return true;
    }

    const shouldParallelize = validatingCalls.every((call) =>
      this.isParallelizable(call),
    );

    if (shouldParallelize && validatingCalls.length > 1) {
      await Promise.all(
        validatingCalls.map((call) =>
          this._processValidatingCall(call, signal),
        ),
      );
    } else {
      await this._processValidatingCall(validatingCalls[0], signal);
    }

    return true;
  }

  private async maybeDelayForHint(signal: AbortSignal): Promise<void> {
    const pendingHints = this.config.peekUserHints();
    const lastHintAt = this.config.getLastUserHintAt();
    if (pendingHints.length === 0 || lastHintAt === null) {
      return;
    }

    const remainingMs = HINT_DEBOUNCE_MS - (Date.now() - lastHintAt);
    if (remainingMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }

      const onAbort = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      const timeoutId = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, remainingMs);

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private async _processValidatingCall(
    active: ValidatingToolCall,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await this._processToolCall(active, signal);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // If the signal aborted while we were waiting on something, treat as
      // cancelled. Otherwise, it's a genuine unhandled system exception.
      if (signal.aborted || err.name === 'AbortError') {
        this.state.updateStatus(
          active.request.callId,
          'cancelled',
          'Operation cancelled',
        );
      } else {
        this.state.updateStatus(
          active.request.callId,
          'error',
          createErrorResponse(
            active.request,
            err,
            ToolErrorType.UNHANDLED_EXCEPTION,
          ),
        );
      }
    }

    // Fetch the updated call from state before finalizing to capture the
    // terminal status.
    const terminalCall = this.state.getToolCall(active.request.callId);
    if (terminalCall && this.isTerminal(terminalCall.status)) {
      logToolCall(
        this.config,
        new ToolCallEvent(terminalCall as CompletedToolCall),
      );
    }

    this.state.finalizeCall(active.request.callId);
  }

  // --- Phase 3: Single Call Orchestration ---

  private async _processToolCall(
    toolCall: ValidatingToolCall,
    signal: AbortSignal,
  ): Promise<void> {
    const callId = toolCall.request.callId;

    // Policy & Security
    const decision = await checkPolicy(toolCall, this.config);

    if (decision === PolicyDecision.DENY) {
      const errorMessage =
        this.config.getApprovalMode() === ApprovalMode.PLAN
          ? PLAN_MODE_DENIAL_MESSAGE
          : 'Tool execution denied by policy.';
      const errorType =
        this.config.getApprovalMode() === ApprovalMode.PLAN
          ? ToolErrorType.STOP_EXECUTION
          : ToolErrorType.POLICY_VIOLATION;
      this.state.updateStatus(
        callId,
        'error',
        createErrorResponse(
          toolCall.request,
          new Error(errorMessage),
          errorType,
        ),
      );
      return;
    }

    // User Confirmation Loop
    let outcome = ToolConfirmationOutcome.ProceedOnce;
    let lastDetails: SerializableConfirmationDetails | undefined;

    if (decision === PolicyDecision.ASK_USER) {
      const result = await resolveConfirmation(toolCall, signal, {
        config: this.config,
        messageBus: this.messageBus,
        state: this.state,
        modifier: this.modifier,
        getPreferredEditor: this.getPreferredEditor,
      });
      outcome = result.outcome;
      lastDetails = result.lastDetails;
    } else {
      this.state.setOutcome(callId, ToolConfirmationOutcome.ProceedOnce);
    }

    // Handle Policy Updates
    await updatePolicy(toolCall.tool, outcome, lastDetails, {
      config: this.config,
      messageBus: this.messageBus,
    });

    // Handle cancellation (cascades to entire batch)
    if (outcome === ToolConfirmationOutcome.Cancel) {
      this.state.updateStatus(callId, 'cancelled', 'User denied execution.');
      this.state.cancelAllQueued('User cancelled operation');
      return; // Skip execution
    }

    // Execution
    await this._execute(callId, signal);
  }

  // --- Sub-phase Handlers ---

  /**
   * Executes the tool and records the result.
   */
  private async _execute(callId: string, signal: AbortSignal): Promise<void> {
    this.state.updateStatus(callId, 'scheduled');
    if (signal.aborted) throw new Error('Operation cancelled');
    this.state.updateStatus(callId, 'executing');

    const executingCall = this.state.getToolCall(callId) as
      | ExecutingToolCall
      | undefined;
    if (!executingCall) {
      throw new Error(`Cannot execute tool call ${callId}: not found.`);
    }

    const result = await this.executor.execute({
      call: executingCall,
      signal,
      outputUpdateHandler: (id, out) =>
        this.state.updateStatus(id, 'executing', { liveOutput: out }),
      onUpdateToolCall: (updated) => {
        if (updated.status === 'executing' && updated.pid) {
          this.state.updateStatus(callId, 'executing', { pid: updated.pid });
        }
      },
    });

    if (result.status === 'success') {
      this.state.updateStatus(callId, 'success', result.response);
    } else if (result.status === 'cancelled') {
      this.state.updateStatus(callId, 'cancelled', 'Operation cancelled');
    } else {
      this.state.updateStatus(callId, 'error', result.response);
    }
  }

  private _processNextInRequestQueue() {
    if (this.requestQueue.length > 0) {
      const next = this.requestQueue.shift()!;
      this.schedule(next.requests, next.signal)
        .then(next.resolve)
        .catch(next.reject);
    }
  }
}
