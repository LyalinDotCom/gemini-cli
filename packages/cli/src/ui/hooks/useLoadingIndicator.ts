/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamingState } from '../types.js';
import { useTimer } from './useTimer.js';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getDisplayString,
  type RetryAttemptPayload,
  type ThoughtSummary,
  type Config,
} from '@google/gemini-cli-core';
import type { TrackedToolCall } from './useToolScheduler.js';
import { useToolStatusMessage } from './useToolStatusMessage.js';
import { useThoughtSummarizer } from './useThoughtSummarizer.js';

/**
 * Phrase shown when an interactive shell is awaiting user input.
 */
export const INTERACTIVE_SHELL_WAITING_PHRASE =
  'Interactive shell awaiting input... press tab to focus shell';

export interface UseLoadingIndicatorProps {
  streamingState: StreamingState;
  shouldShowFocusHint: boolean;
  retryStatus: RetryAttemptPayload | null;
  /** Pending tool calls from the scheduler */
  pendingToolCalls?: TrackedToolCall[];
  /** Current thought from the model */
  thought?: ThoughtSummary | null;
  /** Config for thought summarization (optional, passed from ConfigProvider) */
  config?: Config;
}

/**
 * Hook to compute loading indicator state with helpful status messages.
 *
 * Priority order for status messages:
 * 1. Interactive shell waiting (user action required)
 * 2. Retry status (connection issues)
 * 3. Tool awaiting confirmation ("confirm: reading file.ts")
 * 4. Tool executing ("reading file.ts")
 * 5. Summarized thought (Flash Lite summary of model thinking)
 * 6. Raw thought subject (fallback while summarizing)
 * 7. Generic "Thinking..." (final fallback)
 */
export const useLoadingIndicator = ({
  streamingState,
  shouldShowFocusHint,
  retryStatus,
  pendingToolCalls,
  thought,
  config,
}: UseLoadingIndicatorProps) => {
  const [timerResetKey, setTimerResetKey] = useState(0);
  const isTimerActive = streamingState === StreamingState.Responding;

  const elapsedTimeFromTimer = useTimer(isTimerActive, timerResetKey);

  const [retainedElapsedTime, setRetainedElapsedTime] = useState(0);
  const prevStreamingStateRef = useRef<StreamingState | null>(null);

  useEffect(() => {
    if (
      prevStreamingStateRef.current === StreamingState.WaitingForConfirmation &&
      streamingState === StreamingState.Responding
    ) {
      setTimerResetKey((prevKey) => prevKey + 1);
      setRetainedElapsedTime(0);
    } else if (
      streamingState === StreamingState.Idle &&
      prevStreamingStateRef.current === StreamingState.Responding
    ) {
      setTimerResetKey((prevKey) => prevKey + 1);
      setRetainedElapsedTime(0);
    } else if (streamingState === StreamingState.WaitingForConfirmation) {
      setRetainedElapsedTime(elapsedTimeFromTimer);
    }

    prevStreamingStateRef.current = streamingState;
  }, [streamingState, elapsedTimeFromTimer]);

  // Get tool status messages
  const { executingMessage, confirmationMessage } =
    useToolStatusMessage(pendingToolCalls);

  // Get summarized thought (config is optional - works without it)
  const { summarizedThought } = useThoughtSummarizer(
    thought,
    streamingState,
    config,
  );

  // Compute the loading phrase based on priority
  const currentLoadingPhrase = useMemo(() => {
    // Priority 1: Interactive shell waiting
    if (shouldShowFocusHint) {
      return INTERACTIVE_SHELL_WAITING_PHRASE;
    }

    // Priority 2: Retry status
    if (retryStatus) {
      return `Trying to reach ${getDisplayString(retryStatus.model)} (Attempt ${retryStatus.attempt + 1}/${retryStatus.maxAttempts})`;
    }

    // Priority 3: Waiting for user confirmation
    if (streamingState === StreamingState.WaitingForConfirmation) {
      return confirmationMessage || 'Waiting for user confirmation...';
    }

    // Priority 4: Tool executing
    if (executingMessage) {
      return executingMessage;
    }

    // Priority 5 & 6: Summarized thought or raw thought subject
    if (summarizedThought) {
      return summarizedThought;
    }

    // Priority 7: Generic fallback
    return 'Thinking...';
  }, [
    shouldShowFocusHint,
    retryStatus,
    streamingState,
    confirmationMessage,
    executingMessage,
    summarizedThought,
  ]);

  return {
    elapsedTime:
      streamingState === StreamingState.WaitingForConfirmation
        ? retainedElapsedTime
        : elapsedTimeFromTimer,
    currentLoadingPhrase,
  };
};
