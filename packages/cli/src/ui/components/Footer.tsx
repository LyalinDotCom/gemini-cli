/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { getDisplayString, ApprovalMode } from '@google/gemini-cli-core';
import { ConsoleSummaryDisplay } from './ConsoleSummaryDisplay.js';
import { MemoryUsageDisplay } from './MemoryUsageDisplay.js';
import { ContextUsageDisplay } from './ContextUsageDisplay.js';
import { DebugProfiler } from './DebugProfiler.js';
import { isDevelopment } from '../../utils/installationInfo.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { useVimMode } from '../contexts/VimModeContext.js';
import { ShellModeIndicator } from './ShellModeIndicator.js';
import { ApprovalModeIndicator } from './ApprovalModeIndicator.js';
import { RawMarkdownIndicator } from './RawMarkdownIndicator.js';

export const Footer: React.FC = () => {
  const uiState = useUIState();
  const config = useConfig();
  const settings = useSettings();
  const { vimEnabled, vimMode } = useVimMode();

  const {
    model,
    debugMode,
    debugMessage,
    corgiMode,
    errorCount,
    showErrorDetails,
    promptTokenCount,
    mainAreaWidth,
    shellModeActive,
    showApprovalModeIndicator,
    renderMarkdown,
  } = {
    model: uiState.currentModel,
    debugMode: config.getDebugMode(),
    debugMessage: uiState.debugMessage,
    corgiMode: uiState.corgiMode,
    errorCount: uiState.errorCount,
    showErrorDetails: uiState.showErrorDetails,
    promptTokenCount: uiState.sessionStats.lastPromptTokenCount,
    mainAreaWidth: uiState.mainAreaWidth,
    shellModeActive: uiState.shellModeActive,
    showApprovalModeIndicator: uiState.showApprovalModeIndicator,
    renderMarkdown: uiState.renderMarkdown,
  };

  const showMemoryUsage =
    config.getDebugMode() || settings.merged.ui.showMemoryUsage;
  const hideModelInfo = settings.merged.ui.footer.hideModelInfo;
  const hideContextPercentage = settings.merged.ui.footer.hideContextPercentage;

  const displayVimMode = vimEnabled ? vimMode : undefined;

  const showDebugProfiler = debugMode || isDevelopment;

  // Determine if any mode indicator is shown
  const hasApprovalModeIndicator =
    showApprovalModeIndicator !== ApprovalMode.DEFAULT && !shellModeActive;
  const hasRawMarkdownIndicator = !renderMarkdown;

  return (
    <Box
      justifyContent="space-between"
      width={mainAreaWidth}
      flexDirection="row"
      alignItems="center"
      paddingX={1}
      marginBottom={1}
    >
      {/* Left Section: Mode indicators, Debug profiler and Vim mode */}
      <Box>
        {shellModeActive && <ShellModeIndicator />}
        {hasApprovalModeIndicator && (
          <ApprovalModeIndicator approvalMode={showApprovalModeIndicator} />
        )}
        {hasRawMarkdownIndicator && <RawMarkdownIndicator />}
        {showDebugProfiler && <DebugProfiler />}
        {displayVimMode && (
          <Text color={theme.text.secondary}>[{displayVimMode}] </Text>
        )}
        {debugMode && (
          <Text color={theme.status.error}>
            {' ' + (debugMessage || '--debug')}
          </Text>
        )}
      </Box>

      {/* Right Section: Model info and Console Summary */}
      {!hideModelInfo && (
        <Box alignItems="center" justifyContent="flex-end">
          <Box alignItems="center">
            <Text color={theme.text.accent}>
              {getDisplayString(model, config.getPreviewFeatures())}
              <Text color={theme.text.secondary}> /model</Text>
              {!hideContextPercentage && (
                <>
                  {' '}
                  <ContextUsageDisplay
                    promptTokenCount={promptTokenCount}
                    model={model}
                    terminalWidth={mainAreaWidth}
                  />
                </>
              )}
            </Text>
            {showMemoryUsage && <MemoryUsageDisplay />}
          </Box>
          <Box alignItems="center">
            {corgiMode && (
              <Box paddingLeft={1} flexDirection="row">
                <Text>
                  <Text color={theme.ui.symbol}>| </Text>
                  <Text color={theme.status.error}>▼</Text>
                  <Text color={theme.text.primary}>(´</Text>
                  <Text color={theme.status.error}>ᴥ</Text>
                  <Text color={theme.text.primary}>`)</Text>
                  <Text color={theme.status.error}>▼</Text>
                </Text>
              </Box>
            )}
            {!showErrorDetails && errorCount > 0 && (
              <Box paddingLeft={1} flexDirection="row">
                <Text color={theme.ui.comment}>| </Text>
                <ConsoleSummaryDisplay errorCount={errorCount} />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
