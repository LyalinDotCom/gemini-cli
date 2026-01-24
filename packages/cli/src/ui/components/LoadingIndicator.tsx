/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { useStreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState } from '../types.js';
import { GeminiRespondingSpinner } from './GeminiRespondingSpinner.js';
import { formatDuration } from '../utils/formatters.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { isNarrowWidth } from '../utils/isNarrowWidth.js';

interface LoadingIndicatorProps {
  /** The status message to display (already prioritized by useLoadingIndicator) */
  currentLoadingPhrase?: string;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Optional content to display on the right side */
  rightContent?: React.ReactNode;
}

/**
 * Loading indicator component that displays status messages during model responses.
 *
 * The status message (currentLoadingPhrase) is computed by useLoadingIndicator
 * which handles priority:
 * - Interactive shell waiting
 * - Tool status (executing, awaiting confirmation)
 * - Thought summary
 * - Generic "Thinking..." fallback
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  currentLoadingPhrase,
  elapsedTime,
  rightContent,
}) => {
  const streamingState = useStreamingContext();
  const { columns: terminalWidth } = useTerminalSize();
  const isNarrow = isNarrowWidth(terminalWidth);

  const isIdle = streamingState === StreamingState.Idle;

  const cancelAndTimerContent =
    !isIdle && streamingState !== StreamingState.WaitingForConfirmation
      ? `esc to cancel, ${elapsedTime < 60 ? `${elapsedTime}s` : formatDuration(elapsedTime * 1000)}`
      : null;

  // Status text: "Ready" when idle, loading phrase when active
  // Truncate to prevent line wrapping (leave room for spinner, spacing, and right content)
  const MAX_STATUS_LENGTH = 40;
  const rawStatusText = isIdle ? 'Ready' : currentLoadingPhrase;
  const statusText =
    rawStatusText && rawStatusText.length > MAX_STATUS_LENGTH
      ? rawStatusText.slice(0, MAX_STATUS_LENGTH - 3) + '...'
      : rawStatusText;

  // Spinner takes about 2 chars + 1 margin = 3 chars
  const SPINNER_WIDTH = 3;

  return (
    <Box
      paddingLeft={0}
      flexDirection="column"
      width={terminalWidth}
      marginTop={2}
    >
      {/* Countdown line - only shown when actively loading, aligned with status text */}
      {cancelAndTimerContent && (
        <Box paddingLeft={SPINNER_WIDTH}>
          <Text color={theme.text.secondary}>{cancelAndTimerContent}</Text>
        </Box>
      )}
      {/* Main status line */}
      <Box
        width={terminalWidth}
        flexDirection={isNarrow ? 'column' : 'row'}
        alignItems={isNarrow ? 'flex-start' : 'center'}
        justifyContent="space-between"
      >
        <Box flexShrink={0}>
          <Box marginRight={1} flexShrink={0} minWidth={2}>
            {isIdle ? (
              // Empty space to match spinner width when idle
              <Text> </Text>
            ) : (
              <GeminiRespondingSpinner
                nonRespondingDisplay={
                  streamingState === StreamingState.WaitingForConfirmation
                    ? '⠏'
                    : ''
                }
              />
            )}
          </Box>
          {statusText && <Text color={theme.text.accent}>{statusText}</Text>}
          {isIdle && <Text color={theme.text.secondary}> ? for help</Text>}
        </Box>
        {!isNarrow && rightContent && (
          <Box flexShrink={0} justifyContent="flex-end">
            {rightContent}
          </Box>
        )}
      </Box>
      {isNarrow && rightContent && <Box>{rightContent}</Box>}
    </Box>
  );
};
