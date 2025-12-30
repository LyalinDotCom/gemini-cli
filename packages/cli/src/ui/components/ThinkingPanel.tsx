/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { useThinkingPanel } from '../contexts/ThinkingPanelContext.js';
import { theme } from '../semantic-colors.js';

interface ThinkingPanelProps {
  width: number;
  height: number;
}

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
  width,
  height,
}) => {
  const { thoughtsHistory } = useThinkingPanel();

  // Reverse to show latest first
  const reversedThoughts = [...thoughtsHistory].reverse();

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={theme.border.default}
      overflow="hidden"
    >
      {/* Header */}
      <Box paddingX={1} borderBottom>
        <Text bold color={theme.text.accent}>
          Thinking
        </Text>
      </Box>

      {/* Thoughts list */}
      <Box
        flexDirection="column"
        paddingX={1}
        paddingY={1}
        overflow="hidden"
        flexGrow={1}
      >
        {reversedThoughts.length === 0 ? (
          <Text dimColor>No thoughts yet...</Text>
        ) : (
          reversedThoughts.map((thought, index) => (
            <Box key={index} flexDirection="column">
              {/* Divider between thoughts (not before first) */}
              {index > 0 && (
                <Box marginY={1}>
                  <Text dimColor>{'─'.repeat(Math.max(width - 4, 10))}</Text>
                </Box>
              )}

              {/* Subject with colored bullet */}
              <Box>
                <Text color="cyan">● </Text>
                <Text bold color={theme.text.accent}>
                  {thought.subject}
                </Text>
              </Box>

              {/* Description with indent */}
              {thought.description && (
                <Box marginLeft={2}>
                  <Text wrap="wrap" color={theme.text.secondary}>
                    {thought.description}
                  </Text>
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
