/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { shortenPath, tildeifyPath } from '@google/gemini-cli-core';
import { ThemedGradient } from './ThemedGradient.js';
import process from 'node:process';

interface SessionInfoProps {
  version: string;
  nightly: boolean;
  targetDir: string;
  isTrustedFolder?: boolean;
  mainAreaWidth: number;
  isSystemPromptOverrideActive?: boolean;
}

/**
 * Renders a bullet item. Only shows if value is provided, unless alwaysShow is true.
 */
const BulletItem: React.FC<{
  label: string;
  value?: React.ReactNode;
  alwaysShow?: boolean;
}> = ({ label, value, alwaysShow }) => {
  if (!alwaysShow && !value) return null;

  return (
    <Box>
      <Text color={theme.text.secondary}>• {label}: </Text>
      {value ?? <Text color={theme.text.secondary}>-</Text>}
    </Box>
  );
};

export const SessionInfo: React.FC<SessionInfoProps> = ({
  version,
  nightly,
  targetDir,
  isTrustedFolder,
  mainAreaWidth,
  isSystemPromptOverrideActive,
}) => {
  const pathLength = Math.max(20, Math.floor(mainAreaWidth * 0.5));
  const displayPath = shortenPath(tildeifyPath(targetDir), pathLength);

  const renderSandboxStatus = () => {
    if (isTrustedFolder === false) {
      return <Text color={theme.status.warning}>untrusted</Text>;
    }
    if (process.env['SANDBOX'] && process.env['SANDBOX'] !== 'sandbox-exec') {
      return (
        <Text color="green">
          {process.env['SANDBOX'].replace(/^gemini-(?:cli-)?/, '')}
        </Text>
      );
    }
    if (process.env['SANDBOX'] === 'sandbox-exec') {
      return (
        <Text color={theme.status.warning}>
          macOS Seatbelt{' '}
          <Text color={theme.text.secondary}>
            ({process.env['SEATBELT_PROFILE']})
          </Text>
        </Text>
      );
    }
    return <Text color={theme.status.error}>none</Text>;
  };

  const renderPath = () => {
    if (nightly) {
      return <ThemedGradient>{displayPath}</ThemedGradient>;
    }
    return <Text color={theme.text.link}>{displayPath}</Text>;
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Client version - always show */}
      <BulletItem
        label="Client"
        value={<Text color={theme.text.secondary}>v{version}</Text>}
        alwaysShow
      />

      {/* Path - always show */}
      <BulletItem label="Path" value={renderPath()} alwaysShow />

      {/* Sandbox - always show */}
      <BulletItem label="Sandbox" value={renderSandboxStatus()} alwaysShow />

      {/* System prompt override indicator */}
      {isSystemPromptOverrideActive && (
        <BulletItem
          label="System"
          value={<Text color={theme.status.warning}>OVERRIDE</Text>}
          alwaysShow
        />
      )}
    </Box>
  );
};
