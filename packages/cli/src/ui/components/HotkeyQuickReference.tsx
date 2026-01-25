/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';

interface HotkeyQuickReferenceProps {
  width: number;
}

const isMac = process.platform === 'darwin';

/**
 * Format a key combination with OS-appropriate modifier symbols
 */
const formatKey = (key: string): string => {
  if (!isMac) return key;
  // Use Mac symbols: ⌃ (Control), ⇧ (Shift)
  return key.replace(/Ctrl\+/g, '⌃').replace(/Shift\+/g, '⇧');
};

/**
 * Get the appropriate key for newline based on OS
 */
const getNewlineKey = (): string =>
  process.platform === 'win32' ? 'Ctrl+Enter' : '⌃J';

interface Hotkey {
  key: string;
  action: string;
}

/**
 * Compact hotkey quick reference display shown when user presses ? with empty input.
 * Three-column layout: input prefixes | hotkeys | hotkeys
 */
export const HotkeyQuickReference: React.FC<HotkeyQuickReferenceProps> = ({
  width,
}) => {
  // Column 1: Input bar prefixes
  const inputKeys: Hotkey[] = [
    { key: '!', action: 'shell mode' },
    { key: '@', action: 'attach file' },
    { key: '/', action: 'commands' },
  ];

  // Columns 2-3: Hotkeys
  const hotkeys: Hotkey[] = [
    { key: formatKey('Ctrl+C'), action: 'quit' },
    { key: formatKey('Ctrl+Y'), action: 'yolo mode' },
    { key: formatKey('Shift+Tab'), action: 'switch modes' },
    { key: getNewlineKey(), action: 'newline' },
    { key: '↑/↓', action: 'history' },
  ];

  // Split hotkeys into two columns
  const midpoint = Math.ceil(hotkeys.length / 2);
  const hotkeyCol1 = hotkeys.slice(0, midpoint);
  const hotkeyCol2 = hotkeys.slice(midpoint);

  // Calculate column widths
  const columnWidth = Math.floor((width - 6) / 3); // 6 for padding/margins

  const renderColumn = (items: Hotkey[], minWidth: number) => (
    <Box flexDirection="column" minWidth={minWidth}>
      {items.map((h) => (
        <Box key={h.key}>
          <Text color={theme.text.accent}>{h.key}</Text>
          <Text color={theme.text.secondary}> {h.action}</Text>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      marginTop={1}
      width={width}
      justifyContent="flex-start"
      gap={3}
    >
      {renderColumn(inputKeys, columnWidth)}
      {renderColumn(hotkeyCol1, columnWidth)}
      {renderColumn(hotkeyCol2, columnWidth)}
    </Box>
  );
};
