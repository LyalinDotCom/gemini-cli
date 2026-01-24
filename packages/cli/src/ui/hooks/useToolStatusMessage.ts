/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import {
  getToolStatusMessage,
  getToolConfirmationMessage,
  type ToolCallInfo,
} from '../utils/toolFriendlyNames.js';
import type { TrackedToolCall } from './useToolScheduler.js';

/**
 * Converts TrackedToolCall to the simplified ToolCallInfo format.
 */
function toToolCallInfo(tc: TrackedToolCall): ToolCallInfo {
  return {
    name: tc.request.name,
    args: tc.request.args,
    status: tc.status,
  };
}

export interface UseToolStatusMessageResult {
  /** Status message for currently executing tools */
  executingMessage: string | undefined;
  /** Status message for tools awaiting confirmation */
  confirmationMessage: string | undefined;
  /** Combined message prioritizing confirmation over execution */
  combinedMessage: string | undefined;
}

/**
 * Hook to generate friendly tool status messages from pending tool calls.
 *
 * This hook processes the pending tool calls and generates human-readable
 * status messages based on the tool type and arguments.
 *
 * @param pendingToolCalls - Array of tracked tool calls from the scheduler
 * @returns Object containing different status message variants
 */
export function useToolStatusMessage(
  pendingToolCalls: TrackedToolCall[] | undefined,
): UseToolStatusMessageResult {
  return useMemo(() => {
    if (!pendingToolCalls || pendingToolCalls.length === 0) {
      return {
        executingMessage: undefined,
        confirmationMessage: undefined,
        combinedMessage: undefined,
      };
    }

    const toolCallInfos = pendingToolCalls.map(toToolCallInfo);

    const executingMessage = getToolStatusMessage(toolCallInfos);
    const confirmationMessage = getToolConfirmationMessage(toolCallInfos);

    // Combined message prioritizes confirmation over execution
    const combinedMessage = confirmationMessage || executingMessage;

    return {
      executingMessage,
      confirmationMessage,
      combinedMessage,
    };
  }, [pendingToolCalls]);
}
