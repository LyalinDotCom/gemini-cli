/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';

interface ThoughtMessageProps {
  summary: string;
  fullThought: string;
  isAction: boolean;
  showFullThought?: boolean; // From settings - controls whether full text is shown
}

export const ThoughtMessage: React.FC<ThoughtMessageProps> = ({
  summary,
  fullThought,
  isAction,
  showFullThought = false,
}) => (
  <Box flexDirection="column" paddingLeft={1} marginBottom={1}>
    <Text dimColor>
      {isAction ? '⚡ ' : '💭 '}
      {summary}
    </Text>
    {showFullThought && fullThought && (
      <Box paddingLeft={3}>
        <Text dimColor wrap="wrap">
          {fullThought}
        </Text>
      </Box>
    )}
  </Box>
);
