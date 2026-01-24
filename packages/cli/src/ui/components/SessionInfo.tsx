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
  branchName?: string;
  isTrustedFolder?: boolean;
  mainAreaWidth: number;
}

export const SessionInfo: React.FC<SessionInfoProps> = ({
  version,
  nightly,
  targetDir,
  branchName,
  isTrustedFolder,
  mainAreaWidth,
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
    return <Text color={theme.status.error}>no sandbox</Text>;
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Version (always show for non-nightly, nightly shows in Header) */}
      {!nightly && <Text color={theme.text.secondary}>v{version}</Text>}

      {/* Path + branch */}
      <Box>
        <Text color={theme.text.secondary}>Path: </Text>
        {nightly ? (
          <ThemedGradient>
            {displayPath}
            {branchName && <Text> ({branchName}*)</Text>}
          </ThemedGradient>
        ) : (
          <Text color={theme.text.link}>
            {displayPath}
            {branchName && (
              <Text color={theme.text.secondary}> ({branchName}*)</Text>
            )}
          </Text>
        )}
      </Box>

      {/* Sandbox/Trust status */}
      <Box>
        <Text color={theme.text.secondary}>Sandbox: </Text>
        {renderSandboxStatus()}
      </Box>
    </Box>
  );
};
