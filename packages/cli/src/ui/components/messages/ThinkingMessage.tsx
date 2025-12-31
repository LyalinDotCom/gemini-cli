/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import type { ThoughtSummary } from '../../types.js';

interface ThinkingMessageProps {
  thoughts: ThoughtSummary[];
  isExpanded: boolean;
  terminalWidth: number;
}

export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({
  thoughts,
  isExpanded,
  terminalWidth,
}) => (
  <Box
    borderStyle="round"
    borderColor="magenta"
    width={terminalWidth}
    paddingX={1}
    flexDirection="column"
  >
    {/* Header - always visible */}
    <Box>
      <Text color="magenta">◆ </Text>
      <Text bold color="magenta">
        Thinking
      </Text>
      <Text dimColor> ({thoughts.length})</Text>
    </Box>

    {/* Content - only when expanded */}
    {isExpanded && (
      <Box flexDirection="column" marginTop={1}>
        {thoughts.map((thought, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color="cyan">● </Text>
              <Text bold>{thought.subject}</Text>
            </Box>
            {thought.description && (
              <Box marginLeft={2}>
                <Text dimColor wrap="wrap">
                  {thought.description}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )}
  </Box>
);
