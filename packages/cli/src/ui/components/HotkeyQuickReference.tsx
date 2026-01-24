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
 */
export const HotkeyQuickReference: React.FC<HotkeyQuickReferenceProps> = ({
  width,
}) => {
  const hotkeys: Hotkey[] = [
    { key: 'Enter', action: 'send' },
    { key: 'Esc', action: 'cancel' },
    { key: formatKey('Ctrl+C'), action: 'quit' },
    { key: formatKey('Ctrl+Y'), action: 'yolo' },
    { key: formatKey('Shift+Tab'), action: 'modes' },
    { key: getNewlineKey(), action: 'newline' },
    { key: '!', action: 'shell' },
    { key: '@', action: 'file' },
    { key: '/help', action: 'commands' },
    { key: '↑/↓', action: 'history' },
  ];

  // Format as: "Hotkeys: Enter send · Esc cancel · ..."
  const separator = ' · ';
  const prefix = 'Hotkeys: ';

  // Calculate if we need to wrap based on width
  const fullLine =
    prefix + hotkeys.map((h) => `${h.key} ${h.action}`).join(separator);

  // If terminal is too narrow, show in multiple lines
  const isNarrow = width < fullLine.length + 4; // Add some margin

  if (isNarrow) {
    // Split into two lines for narrow terminals
    const midpoint = Math.ceil(hotkeys.length / 2);
    const firstHalf = hotkeys.slice(0, midpoint);
    const secondHalf = hotkeys.slice(midpoint);

    return (
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        <Box>
          <Text color={theme.text.secondary}>{prefix}</Text>
          {firstHalf.map((h, i) => (
            <Text key={h.key} color={theme.text.secondary}>
              <Text color={theme.text.accent}>{h.key}</Text> {h.action}
              {i < firstHalf.length - 1 && separator}
            </Text>
          ))}
        </Box>
        <Box paddingLeft={prefix.length}>
          {secondHalf.map((h, i) => (
            <Text key={h.key} color={theme.text.secondary}>
              <Text color={theme.text.accent}>{h.key}</Text> {h.action}
              {i < secondHalf.length - 1 && separator}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  // Single line for wider terminals
  return (
    <Box paddingX={1} marginTop={1}>
      <Text color={theme.text.secondary}>{prefix}</Text>
      {hotkeys.map((h, i) => (
        <Text key={h.key} color={theme.text.secondary}>
          <Text color={theme.text.accent}>{h.key}</Text> {h.action}
          {i < hotkeys.length - 1 && separator}
        </Text>
      ))}
    </Box>
  );
};
