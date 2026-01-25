/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text, Box } from 'ink';
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js';
import { theme } from '../../semantic-colors.js';
import { SCREEN_READER_MODEL_PREFIX } from '../../textConstants.js';
import { useUIState } from '../../contexts/UIStateContext.js';
import { useAlternateBuffer } from '../../hooks/useAlternateBuffer.js';

interface GeminiMessageProps {
  text: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  terminalWidth: number;
  isFinal?: boolean; // true if this is the final response (no tool calls follow)
}

export const GeminiMessage: React.FC<GeminiMessageProps> = ({
  text,
  isPending,
  availableTerminalHeight,
  terminalWidth,
  isFinal = false,
}) => {
  const { renderMarkdown } = useUIState();
  const isAlternateBuffer = useAlternateBuffer();

  // When complete:
  // - Show "✦ Done." header only for final response (no tool calls follow)
  // - Show just "✦ " prefix for intermediate responses (tool calls pending)
  if (!isPending) {
    if (isFinal) {
      return (
        <Box flexDirection="column">
          <Box paddingLeft={1}>
            <Text
              color={theme.text.accent}
              aria-label={SCREEN_READER_MODEL_PREFIX}
            >
              ✦ Done.
            </Text>
          </Box>
          <Box flexDirection="column" paddingLeft={2} marginTop={1}>
            <MarkdownDisplay
              text={text}
              isPending={isPending}
              availableTerminalHeight={
                isAlternateBuffer ? undefined : availableTerminalHeight
              }
              terminalWidth={terminalWidth}
              renderMarkdown={renderMarkdown}
            />
          </Box>
        </Box>
      );
    }

    // Intermediate response (tool calls follow) - just show prefix without "Done"
    const prefix = '✦ ';
    const prefixWidth = prefix.length;

    return (
      <Box flexDirection="row">
        <Box width={prefixWidth}>
          <Text
            color={theme.text.accent}
            aria-label={SCREEN_READER_MODEL_PREFIX}
          >
            {prefix}
          </Text>
        </Box>
        <Box flexGrow={1} flexDirection="column">
          <MarkdownDisplay
            text={text}
            isPending={isPending}
            availableTerminalHeight={
              isAlternateBuffer ? undefined : availableTerminalHeight
            }
            terminalWidth={terminalWidth}
            renderMarkdown={renderMarkdown}
          />
        </Box>
      </Box>
    );
  }

  // While streaming, use inline prefix layout
  const prefix = '✦ ';
  const prefixWidth = prefix.length;

  return (
    <Box flexDirection="row">
      <Box width={prefixWidth}>
        <Text color={theme.text.accent} aria-label={SCREEN_READER_MODEL_PREFIX}>
          {prefix}
        </Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        <MarkdownDisplay
          text={text}
          isPending={isPending}
          availableTerminalHeight={
            isAlternateBuffer ? undefined : availableTerminalHeight
          }
          terminalWidth={terminalWidth}
          renderMarkdown={renderMarkdown}
        />
      </Box>
    </Box>
  );
};
