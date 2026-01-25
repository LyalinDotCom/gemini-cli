/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  summarizeThought,
  THOUGHT_SUMMARIZATION_RATE_LIMIT_MS,
  MIN_THOUGHT_LENGTH_FOR_SUMMARIZATION,
} from '@google/gemini-cli-core';
import type { ThoughtSummary, Config } from '@google/gemini-cli-core';
import { StreamingState } from '../types.js';

export interface UseThoughtSummarizerResult {
  /** The summarized thought, or raw thought subject if summarization is pending/disabled */
  summarizedThought: string | undefined;
  /** Whether a summarization request is currently in progress */
  isSummarizing: boolean;
  /** The full thought text for history display */
  fullThought: string | undefined;
  /** Whether tool calls followed this thought (action vs considering tone) */
  isAction: boolean;
}

/**
 * Hook to summarize model thoughts using Flash Lite.
 *
 * This hook provides rate-limited summarization of model thoughts,
 * generating brief status messages suitable for display in the loading indicator.
 *
 * Rate limiting ensures we don't spam the API with requests during
 * rapid thought updates.
 *
 * @param thought - The current thought from the model
 * @param streamingState - Current streaming state
 * @param config - Optional config for accessing gemini client
 * @param hasPendingToolCalls - Whether tool calls are pending (for action vs considering tone)
 * @returns Object containing the summarized thought, loading state, and full thought data
 */
export function useThoughtSummarizer(
  thought: ThoughtSummary | null | undefined,
  streamingState: StreamingState,
  config?: Config,
  hasPendingToolCalls?: boolean,
): UseThoughtSummarizerResult {
  const [summarizedThought, setSummarizedThought] = useState<
    string | undefined
  >(undefined);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [fullThought, setFullThought] = useState<string | undefined>(undefined);
  const [isAction, setIsAction] = useState(false);

  // Track the last summarization time for rate limiting
  const lastSummarizationTimeRef = useRef<number>(0);
  // Track the current abort controller for canceling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track the thought that's currently being summarized
  const summarizingThoughtRef = useRef<string | null>(null);

  const summarize = useCallback(
    async (description: string, actionMode?: boolean) => {
      if (!config) {
        return description;
      }

      const geminiClient = config.getGeminiClient();
      if (!geminiClient) {
        return description;
      }

      // Cancel any previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      summarizingThoughtRef.current = description;

      try {
        setIsSummarizing(true);
        const summary = await summarizeThought(
          config,
          description,
          geminiClient,
          abortController.signal,
          actionMode,
        );

        // Only update if this is still the thought we're summarizing
        if (summarizingThoughtRef.current === description) {
          return summary;
        }
        return undefined;
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return undefined;
        }
        // On other errors, return the original description
        return description;
      } finally {
        if (summarizingThoughtRef.current === description) {
          setIsSummarizing(false);
          summarizingThoughtRef.current = null;
        }
      }
    },
    [config],
  );

  useEffect(() => {
    // Reset when idle
    if (streamingState === StreamingState.Idle) {
      setSummarizedThought(undefined);
      setFullThought(undefined);
      setIsAction(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    // No thought to summarize
    if (!thought?.description) {
      setSummarizedThought(thought?.subject);
      setFullThought(undefined);
      return;
    }

    const description = thought.description;
    const actionMode = !!hasPendingToolCalls;

    // Update full thought and action state
    setFullThought(description);
    setIsAction(actionMode);

    // Use raw subject for short thoughts
    if (description.length < MIN_THOUGHT_LENGTH_FOR_SUMMARIZATION) {
      setSummarizedThought(thought.subject);
      return;
    }

    // If no config, just use raw subject
    if (!config) {
      setSummarizedThought(thought.subject);
      return;
    }

    // Check rate limit
    const now = Date.now();
    const timeSinceLastSummarization = now - lastSummarizationTimeRef.current;

    if (timeSinceLastSummarization < THOUGHT_SUMMARIZATION_RATE_LIMIT_MS) {
      // Still within rate limit, show raw subject
      setSummarizedThought(thought.subject);
      return;
    }

    // Perform summarization
    lastSummarizationTimeRef.current = now;

    // Show raw subject while summarizing
    setSummarizedThought(thought.subject);

    // Start async summarization
    void (async () => {
      const summary = await summarize(description, actionMode);
      if (summary) {
        setSummarizedThought(summary);
      }
    })();
    // Note: hasPendingToolCalls is intentionally excluded from dependencies
    // It's only used to determine summarization tone, not to trigger re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought, streamingState, summarize, config]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
    [],
  );

  return {
    summarizedThought,
    isSummarizing,
    fullThought,
    isAction,
  };
}
