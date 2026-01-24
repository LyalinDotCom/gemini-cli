/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { STATUS_INDICATOR_WIDTH } from './ToolShared.js';
import { theme } from '../../semantic-colors.js';

// Tree character for result continuation
const RESULT_TREE_CHAR = '⎿';

export interface MinimalToolResultProps {
  children: React.ReactNode;
  terminalWidth: number;
  /** If true, shows tree character before content */
  showTreeChar?: boolean;
}

/**
 * Wrapper component that indents tool results to align with the status indicator.
 * The result content is indented by STATUS_INDICATOR_WIDTH spaces (3 chars)
 * to align with the end of the status icon.
 *
 * Layout:
 *   ✓  ToolName description
 *    ⎿ Result line 1
 *      Result line 2 (aligned with line 1)
 */
export const MinimalToolResult: React.FC<MinimalToolResultProps> = ({
  children,
  terminalWidth,
  showTreeChar = true,
}) => {
  // Account for tree char width (2 chars: char + space)
  const TREE_CHAR_WIDTH = showTreeChar ? 2 : 0;
  const contentWidth = terminalWidth - STATUS_INDICATOR_WIDTH - TREE_CHAR_WIDTH;

  return (
    <Box width={terminalWidth}>
      {/* Indent to align with status icon */}
      <Box width={STATUS_INDICATOR_WIDTH - 1} flexShrink={0} />
      {/* Tree character */}
      {showTreeChar && (
        <Box flexShrink={0}>
          <Text color={theme.text.secondary}>{RESULT_TREE_CHAR} </Text>
        </Box>
      )}
      {/* Content */}
      <Box flexDirection="column" width={contentWidth}>
        {children}
      </Box>
    </Box>
  );
};
