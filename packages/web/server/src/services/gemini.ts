/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Config,
  FileDiscoveryService,
  ApprovalMode,
  AuthType,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  SimpleExtensionLoader,
  loadServerHierarchicalMemory,
  GeminiEventType,
  type GeminiClient,
  loadApiKey,
  OAuthCredentialStorage,
  CoreToolScheduler,
  type ToolCallRequestInfo,
  type CompletedToolCall,
  type ToolCallConfirmationDetails,
} from '@google/gemini-cli-core';
import type { Part } from '@google/genai';
// Import settings loader from CLI package - same logic CLI uses
import {
  loadSettings,
  type LoadedSettings,
  loadEnvironment,
} from '@google/gemini-cli/dist/src/config/settings.js';

export type DetectedAuthType = AuthType | null;

/**
 * Detect available authentication method by checking:
 * 1. Environment variables (GEMINI_API_KEY, GOOGLE_APPLICATION_CREDENTIALS)
 * 2. Stored API key (from previous CLI usage)
 * 3. Stored OAuth credentials (from previous CLI login)
 */
export async function detectAuthMethod(): Promise<{
  authType: DetectedAuthType;
  hasKey: boolean;
}> {
  // 1. Check for Gemini API key in environment
  if (process.env['GEMINI_API_KEY']) {
    console.log('[Auth] Found GEMINI_API_KEY in environment');
    return { authType: AuthType.USE_GEMINI, hasKey: true };
  }

  // 2. Check for stored API key (user ran CLI and entered key before)
  try {
    const storedApiKey = await loadApiKey();
    if (storedApiKey) {
      console.log('[Auth] Found stored API key from CLI');
      // Set it in env so core can use it
      process.env['GEMINI_API_KEY'] = storedApiKey;
      return { authType: AuthType.USE_GEMINI, hasKey: true };
    }
  } catch (err) {
    console.warn('[Auth] Failed to load stored API key:', err);
  }

  // 3. Check for stored OAuth credentials (user logged in via CLI)
  try {
    const oauthCreds = await OAuthCredentialStorage.loadCredentials();
    if (oauthCreds?.access_token) {
      console.log('[Auth] Found stored OAuth credentials from CLI');
      return { authType: AuthType.LOGIN_WITH_GOOGLE, hasKey: true };
    }
  } catch (err) {
    console.warn('[Auth] Failed to load OAuth credentials:', err);
  }

  // 4. Check for Google ADC
  if (process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
    console.log('[Auth] Found GOOGLE_APPLICATION_CREDENTIALS');
    return { authType: AuthType.LOGIN_WITH_GOOGLE, hasKey: true };
  }

  // No auth found
  console.log('[Auth] No authentication method detected');
  return { authType: null, hasKey: false };
}

export interface ChatCallbacks {
  onContent: (text: string) => void;
  onToolCall: (
    toolId: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => void;
  onToolStatus: (
    toolId: string,
    status: 'executing' | 'success' | 'error',
    result?: string,
  ) => void;
  onConfirmationRequest: (
    correlationId: string,
    toolName: string,
    args: Record<string, unknown>,
    confirmationDetails: ToolCallConfirmationDetails,
  ) => void;
  onError: (error: string) => void;
  onFinished?: () => void;
}

export class GeminiService {
  private config: Config | null = null;
  private geminiClient: GeminiClient | null = null;
  private toolScheduler: CoreToolScheduler | null = null;
  private workspacePath: string;
  private sessionId: string;
  private promptCount = 0;
  private loadedSettings: LoadedSettings | null = null;

  // State for current chat interaction
  private currentCallbacks: ChatCallbacks | null = null;
  private currentAbortController: AbortController | null = null;
  private currentPromptId: string | null = null;

  constructor(workspacePath: string, sessionId: string) {
    this.workspacePath = workspacePath;
    this.sessionId = sessionId;
  }

  getModelName(): string {
    return this.loadedSettings?.merged?.model?.name || DEFAULT_GEMINI_MODEL;
  }

  async initialize(): Promise<void> {
    console.log(
      `[GeminiService] Initializing for workspace: ${this.workspacePath}`,
    );

    // Load settings using CLI's loadSettings - same as CLI does
    // This loads from ~/.gemini/settings.json, workspace settings, system settings, etc.
    this.loadedSettings = loadSettings(this.workspacePath);
    const settings = this.loadedSettings.merged;

    console.log(
      `[Settings] Loaded - model: ${settings.model?.name}, auth: ${settings.security?.auth?.selectedType}`,
    );

    // Load environment variables from .env files (same as CLI)
    loadEnvironment(settings);

    const fileService = new FileDiscoveryService(this.workspacePath);
    const extensionLoader = new SimpleExtensionLoader([]);

    // Load memory (GEMINI.md files)
    let memoryContent = '';
    let fileCount = 0;
    try {
      const result = await loadServerHierarchicalMemory(
        this.workspacePath,
        [this.workspacePath],
        false,
        fileService,
        extensionLoader,
        this.loadedSettings.isTrusted,
      );
      memoryContent = result.memoryContent;
      fileCount = result.fileCount;
    } catch (err) {
      console.warn('[GeminiService] Failed to load memory files:', err);
    }

    // Determine approval mode from environment or settings
    const approvalMode =
      process.env['GEMINI_YOLO_MODE'] === 'true'
        ? ApprovalMode.YOLO
        : ApprovalMode.DEFAULT;

    // Use model from settings, then env, then default
    const modelName =
      settings.model?.name ||
      process.env['GEMINI_MODEL'] ||
      DEFAULT_GEMINI_MODEL;
    console.log(`[GeminiService] Using model: ${modelName}`);

    this.config = new Config({
      sessionId: this.sessionId,
      model: modelName,
      embeddingModel: DEFAULT_GEMINI_EMBEDDING_MODEL,
      sandbox: undefined,
      targetDir: this.workspacePath,
      debugMode: process.env['DEBUG'] === 'true',
      question: '',
      userMemory: memoryContent,
      geminiMdFileCount: fileCount,
      approvalMode,
      cwd: this.workspacePath,
      ideMode: false,
      folderTrust: this.loadedSettings.isTrusted,
      extensionLoader,
      interactive: true,

      // Model settings from CLI settings
      maxSessionTurns: settings.model?.maxSessionTurns,
      compressionThreshold: settings.model?.compressionThreshold,
      skipNextSpeakerCheck: settings.model?.skipNextSpeakerCheck,
      summarizeToolOutput: settings.model?.summarizeToolOutput,

      // General settings
      checkpointing: settings.general?.checkpointing?.enabled ?? false,
      retryFetchErrors: settings.general?.retryFetchErrors,
      enablePromptCompletion: settings.general?.enablePromptCompletion,

      // Tool settings
      coreTools: settings.tools?.core,
      allowedTools: settings.tools?.allowed,
      excludeTools: settings.tools?.exclude,
      toolDiscoveryCommand: settings.tools?.discoveryCommand,
      toolCallCommand: settings.tools?.callCommand,
      useRipgrep: settings.tools?.useRipgrep,
      enableInteractiveShell: settings.tools?.shell?.enableInteractiveShell,
      shellToolInactivityTimeout: settings.tools?.shell?.inactivityTimeout,

      // MCP settings
      mcpServers: settings.mcpServers,
      mcpServerCommand: settings.mcp?.serverCommand,
      allowedMcpServers: settings.mcp?.allowed,
      blockedMcpServers: settings.mcp?.excluded,

      // Context/file filtering settings
      contextFileName: settings.context?.fileName,
      fileFiltering: settings.context?.fileFiltering ?? {
        respectGitIgnore: true,
        enableRecursiveFileSearch: true,
      },
      includeDirectories: settings.context?.includeDirectories,
      loadMemoryFromIncludeDirectories:
        settings.context?.loadMemoryFromIncludeDirectories,
      importFormat: settings.context?.importFormat,
      discoveryMaxDirs: settings.context?.discoveryMaxDirs,

      // UI settings
      accessibility: settings.ui?.accessibility,
      showMemoryUsage: settings.ui?.showMemoryUsage,

      // Telemetry/privacy settings
      telemetry: settings.telemetry,
      usageStatisticsEnabled: settings.privacy?.usageStatisticsEnabled,

      // Experimental settings
      extensionManagement: settings.experimental?.extensionManagement,
    });

    // Initialize the config (sets up tool registry, git checkpointing, etc.)
    await this.config.initialize();

    // Get auth type from settings - same as CLI does
    const settingsAuthType = settings.security?.auth?.selectedType as
      | string
      | undefined;
    let authType: AuthType | null = null;

    if (settingsAuthType) {
      // Map settings auth type string to AuthType enum
      const authTypeStr = settingsAuthType;
      if (
        authTypeStr === 'oauth-personal' ||
        authTypeStr === AuthType.LOGIN_WITH_GOOGLE
      ) {
        authType = AuthType.LOGIN_WITH_GOOGLE;
      } else if (
        authTypeStr === 'gemini-api-key' ||
        authTypeStr === AuthType.USE_GEMINI
      ) {
        authType = AuthType.USE_GEMINI;
      } else if (
        authTypeStr === 'vertex-ai' ||
        authTypeStr === AuthType.USE_VERTEX_AI
      ) {
        authType = AuthType.USE_VERTEX_AI;
      } else if (
        authTypeStr === 'compute-default-credentials' ||
        authTypeStr === AuthType.COMPUTE_ADC
      ) {
        authType = AuthType.COMPUTE_ADC;
      }
      console.log(`[Auth] Using auth type from settings: ${settingsAuthType}`);
    }

    // If no auth type in settings, auto-detect
    if (!authType) {
      const detected = await detectAuthMethod();
      authType = detected.authType;
    }

    if (!authType) {
      throw new Error(
        'No authentication found. Please run "gemini" CLI first to login, ' +
          'or set GEMINI_API_KEY environment variable.',
      );
    }

    console.log(`[GeminiService] Using auth type: ${authType}`);
    await this.config.refreshAuth(authType);

    // Get the GeminiClient
    this.geminiClient = this.config.getGeminiClient();
    await this.geminiClient.initialize();

    // Set up the tool scheduler
    this.toolScheduler = new CoreToolScheduler({
      config: this.config,
      getPreferredEditor: () => undefined, // No editor in web mode
      onToolCallsUpdate: (toolCalls) => {
        // Update UI with current tool call states
        for (const call of toolCalls) {
          if (call.status === 'executing' && this.currentCallbacks) {
            this.currentCallbacks.onToolStatus(
              call.request.callId,
              'executing',
            );
          }
        }
      },
      onAllToolCallsComplete: async (completedCalls) => {
        await this.handleCompletedToolCalls(completedCalls);
      },
    });

    console.log('[GeminiService] Initialized successfully');
  }

  async chat(userMessage: string, callbacks: ChatCallbacks): Promise<void> {
    if (!this.config || !this.geminiClient || !this.toolScheduler) {
      throw new Error('GeminiService not initialized');
    }

    // Set up state for this chat interaction
    this.currentCallbacks = callbacks;
    this.currentAbortController = new AbortController();
    this.currentPromptId = `${this.sessionId}########${this.promptCount++}`;

    try {
      await this.processStream([{ text: userMessage }]);
    } catch (err) {
      console.error('[GeminiService] Chat error:', err);
      callbacks.onError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  /**
   * Process a stream from the model and handle all events including tool calls
   */
  private async processStream(request: Part[]): Promise<void> {
    if (
      !this.geminiClient ||
      !this.toolScheduler ||
      !this.currentCallbacks ||
      !this.currentPromptId ||
      !this.currentAbortController
    ) {
      throw new Error('Invalid state for processStream');
    }

    const callbacks = this.currentCallbacks;
    const abortSignal = this.currentAbortController.signal;
    const promptId = this.currentPromptId;

    const toolCallRequests: ToolCallRequestInfo[] = [];

    try {
      const response = this.geminiClient.sendMessageStream(
        request,
        abortSignal,
        promptId,
      );

      for await (const event of response) {
        if (abortSignal.aborted) {
          console.log('[GeminiService] Request aborted');
          return;
        }

        switch (event.type) {
          case GeminiEventType.Content: {
            callbacks.onContent(event.value);
            break;
          }

          case GeminiEventType.ToolCallRequest: {
            const toolInfo = event.value;
            toolCallRequests.push(toolInfo);
            callbacks.onToolCall(
              toolInfo.callId,
              toolInfo.name,
              toolInfo.args as Record<string, unknown>,
            );
            break;
          }

          case GeminiEventType.Error: {
            callbacks.onError(event.value.error.message);
            break;
          }

          case GeminiEventType.Finished: {
            console.log(
              '[GeminiService] Stream finished, reason:',
              event.value.reason,
            );
            break;
          }

          default:
            // Other events (Thought, Citation, ChatCompressed, etc.) - log them
            console.log(`[GeminiService] Event: ${event.type}`);
            break;
        }
      }

      // After stream ends, if there are tool calls, schedule them
      if (toolCallRequests.length > 0) {
        console.log(
          `[GeminiService] Scheduling ${toolCallRequests.length} tool calls`,
        );
        await this.toolScheduler.schedule(toolCallRequests, abortSignal);
        // The scheduler will call handleCompletedToolCalls when done
      } else {
        // No tool calls, we're done
        callbacks.onFinished?.();
      }
    } catch (err) {
      console.error('[GeminiService] Stream error:', err);
      callbacks.onError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  /**
   * Handle completed tool calls - send responses back to the model
   */
  private async handleCompletedToolCalls(
    completedCalls: CompletedToolCall[],
  ): Promise<void> {
    if (!this.currentCallbacks || !this.geminiClient) {
      console.warn(
        '[GeminiService] No callbacks available for completed tool calls',
      );
      return;
    }

    const callbacks = this.currentCallbacks;

    // Send status updates to the client
    for (const call of completedCalls) {
      const status = call.status === 'success' ? 'success' : 'error';
      let result: string;
      if (call.response.error) {
        result = call.response.error.message;
      } else if (typeof call.response.resultDisplay === 'string') {
        result = call.response.resultDisplay;
      } else if (call.response.resultDisplay) {
        result = JSON.stringify(call.response.resultDisplay);
      } else {
        result = 'Completed';
      }
      callbacks.onToolStatus(call.request.callId, status, result);
    }

    // Check if all tools were cancelled
    const allCancelled = completedCalls.every(
      (call) => call.status === 'cancelled',
    );
    if (allCancelled) {
      console.log('[GeminiService] All tools cancelled, not continuing');
      callbacks.onFinished?.();
      return;
    }

    // Collect response parts from all completed tools
    const responseParts: Part[] = completedCalls.flatMap(
      (call) => call.response.responseParts,
    );

    if (responseParts.length > 0) {
      console.log(
        `[GeminiService] Sending ${responseParts.length} tool responses back to model`,
      );
      // Continue the conversation with tool responses
      await this.processStream(responseParts);
    } else {
      callbacks.onFinished?.();
    }
  }

  /**
   * Handle user confirmation response for a tool
   */
  async resolveConfirmation(
    correlationId: string,
    confirmed: boolean,
  ): Promise<void> {
    if (!this.toolScheduler || !this.currentAbortController) {
      console.warn(
        '[GeminiService] No scheduler or abort controller for confirmation',
      );
      return;
    }

    // The scheduler handles confirmations internally through its message bus
    // We need to find the pending tool call and resolve its confirmation
    console.log(
      `[GeminiService] Confirmation for ${correlationId}: ${confirmed}`,
    );

    // For now, if not confirmed, we cancel
    if (!confirmed) {
      this.toolScheduler.cancelAll(this.currentAbortController.signal);
    }
  }

  dispose(): void {
    // Cleanup resources
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.config = null;
    this.geminiClient = null;
    this.toolScheduler = null;
    this.currentCallbacks = null;
    this.currentAbortController = null;
    this.currentPromptId = null;
  }
}
