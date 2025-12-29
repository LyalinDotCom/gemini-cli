/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box } from 'ink';
import { Notifications } from '../components/Notifications.js';
import { MainContent } from '../components/MainContent.js';
import { DialogManager } from '../components/DialogManager.js';
import { Composer } from '../components/Composer.js';
import { ExitWarning } from '../components/ExitWarning.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useFlickerDetector } from '../hooks/useFlickerDetector.js';
import { useAlternateBuffer } from '../hooks/useAlternateBuffer.js';
import { CopyModeWarning } from '../components/CopyModeWarning.js';
import { useThinkingPanel } from '../contexts/ThinkingPanelContext.js';
import { ThinkingPanel } from '../components/ThinkingPanel.js';

export const DefaultAppLayout: React.FC = () => {
  const uiState = useUIState();
  const isAlternateBuffer = useAlternateBuffer();
  const { panelVisible } = useThinkingPanel();

  const { rootUiRef, terminalHeight, terminalWidth } = uiState;
  useFlickerDetector(rootUiRef, terminalHeight);

  // Calculate widths for split layout
  const panelWidth = Math.floor(terminalWidth / 3);
  // If in alternate buffer mode, need to leave room to draw the scrollbar on
  // the right side of the terminal.
  const baseWidth = isAlternateBuffer ? terminalWidth : uiState.mainAreaWidth;
  // Account for panel border (2 chars) when panel is visible
  const mainWidth = panelVisible ? baseWidth - panelWidth : baseWidth;
  const effectiveHeight = isAlternateBuffer ? terminalHeight - 1 : undefined;

  return (
    <Box flexDirection="row">
      {/* Main content area */}
      <Box
        flexDirection="column"
        width={mainWidth}
        height={effectiveHeight}
        flexShrink={0}
        flexGrow={0}
        overflow="hidden"
        ref={rootUiRef}
      >
        <MainContent />

        <Box
          flexDirection="column"
          ref={uiState.mainControlsRef}
          flexShrink={0}
          flexGrow={0}
        >
          <Notifications />
          <CopyModeWarning />

          {uiState.customDialog ? (
            uiState.customDialog
          ) : uiState.dialogsVisible ? (
            <DialogManager
              terminalWidth={mainWidth}
              addItem={uiState.historyManager.addItem}
            />
          ) : (
            <Composer />
          )}

          <ExitWarning />
        </Box>
      </Box>

      {/* Side panel for thinking content */}
      {panelVisible && (
        <ThinkingPanel
          width={panelWidth}
          height={effectiveHeight || terminalHeight}
        />
      )}
    </Box>
  );
};
