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
      <Box flexDirection="column" paddingX={1} overflow="hidden" flexGrow={1}>
        {reversedThoughts.length === 0 ? (
          <Text dimColor>No thoughts yet...</Text>
        ) : (
          reversedThoughts.map((thought, index) => (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Text bold color={theme.text.accent}>
                {thought.subject}
              </Text>
              {thought.description && (
                <Text wrap="wrap" color={theme.text.secondary}>
                  {thought.description}
                </Text>
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
