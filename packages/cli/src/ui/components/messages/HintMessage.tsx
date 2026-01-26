/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text, Box } from 'ink';
import { theme } from '../../semantic-colors.js';

interface HintMessageProps {
  text: string;
}

export const HintMessage: React.FC<HintMessageProps> = ({ text }) => (
    <Box flexDirection="row" paddingX={1} marginY={0}>
      <Text color={theme.text.accent}>💡 </Text>
      <Text color={theme.text.secondary}>{text}</Text>
    </Box>
  );
