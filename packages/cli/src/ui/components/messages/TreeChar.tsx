/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text } from 'ink';
import { theme } from '../../semantic-colors.js';

export type TreeCharType = 'branch' | 'last' | 'continuation' | 'none';

const TREE_CHARS: Record<TreeCharType, string> = {
  branch: '├',
  last: '└',
  continuation: '│',
  none: ' ',
};

export interface TreeCharProps {
  type: TreeCharType;
}

export const TreeChar: React.FC<TreeCharProps> = ({ type }) => {
  const char = TREE_CHARS[type];

  return <Text color={theme.text.secondary}>{char} </Text>;
};
