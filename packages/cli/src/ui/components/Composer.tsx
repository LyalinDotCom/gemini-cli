/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Box, useIsScreenReaderEnabled } from 'ink';
import { LoadingIndicator } from './LoadingIndicator.js';
import { StatusDisplay } from './StatusDisplay.js';
import { ContextSummaryDisplay } from './ContextSummaryDisplay.js';
import { ApprovalModeIndicator } from './ApprovalModeIndicator.js';
import { ShellModeIndicator } from './ShellModeIndicator.js';
import { DetailedMessagesDisplay } from './DetailedMessagesDisplay.js';
import { RawMarkdownIndicator } from './RawMarkdownIndicator.js';
import { InputPrompt } from './InputPrompt.js';
import { Footer } from './Footer.js';
import { ShowMoreLines } from './ShowMoreLines.js';
import { QueuedMessageDisplay } from './QueuedMessageDisplay.js';
import { OverflowProvider } from '../contexts/OverflowContext.js';
import { isNarrowWidth } from '../utils/isNarrowWidth.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { useVimMode } from '../contexts/VimModeContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { useAlternateBuffer } from '../hooks/useAlternateBuffer.js';
import { ApprovalMode } from '@google/gemini-cli-core';
import { ConfigInitDisplay } from '../components/ConfigInitDisplay.js';
import { TodoTray } from './messages/Todo.js';

export const Composer = ({ isFocused = true }: { isFocused?: boolean }) => {
  const config = useConfig();
  const settings = useSettings();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  const uiState = useUIState();
  const uiActions = useUIActions();
  const { vimEnabled } = useVimMode();
  const terminalWidth = process.stdout.columns;
  const isNarrow = isNarrowWidth(terminalWidth);
  const debugConsoleMaxHeight = Math.floor(Math.max(terminalWidth * 0.2, 5));
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);

  const isAlternateBuffer = useAlternateBuffer();
  const { showApprovalModeIndicator } = uiState;
  const suggestionsPosition = isAlternateBuffer ? 'above' : 'below';
  const hideContextSummary =
    suggestionsVisible && suggestionsPosition === 'above';

  // Context summary to show on the right side of status line
  const contextSummaryContent =
    !settings.merged.ui.hideContextSummary && !hideContextSummary ? (
      <ContextSummaryDisplay
        ideContext={uiState.ideContextState}
        geminiMdFileCount={uiState.geminiMdFileCount}
        contextFileNames={uiState.contextFileNames}
        mcpServers={config.getMcpClientManager()?.getMcpServers() ?? {}}
        blockedMcpServers={
          config.getMcpClientManager()?.getBlockedMcpServers() ?? []
        }
        skillCount={config.getSkillManager().getDisplayableSkills().length}
      />
    ) : undefined;

  return (
    <Box
      flexDirection="column"
      width={uiState.mainAreaWidth}
      flexGrow={0}
      flexShrink={0}
    >
      {!uiState.embeddedShellFocused && (
        <LoadingIndicator
          currentLoadingPhrase={
            config.getAccessibility()?.enableLoadingPhrases === false
              ? undefined
              : uiState.currentLoadingPhrase
          }
          elapsedTime={uiState.elapsedTime}
          rightContent={contextSummaryContent}
        />
      )}

      {(!uiState.slashCommands || !uiState.isConfigInitialized) && (
        <ConfigInitDisplay />
      )}

      <QueuedMessageDisplay messageQueue={uiState.messageQueue} />

      <TodoTray />

      {/* Status bar: warnings/status and mode indicators - no margin to keep compact */}
      <Box
        width={uiState.mainAreaWidth}
        flexDirection={isNarrow ? 'column' : 'row'}
        alignItems={isNarrow ? 'flex-start' : 'center'}
      >
        <StatusDisplay hideContextSummary={true} />
        {showApprovalModeIndicator !== ApprovalMode.DEFAULT &&
          !uiState.shellModeActive && (
            <ApprovalModeIndicator approvalMode={showApprovalModeIndicator} />
          )}
        {uiState.shellModeActive && <ShellModeIndicator />}
        {!uiState.renderMarkdown && <RawMarkdownIndicator />}
      </Box>

      {uiState.showErrorDetails && (
        <OverflowProvider>
          <Box flexDirection="column">
            <DetailedMessagesDisplay
              messages={uiState.filteredConsoleMessages}
              maxHeight={
                uiState.constrainHeight ? debugConsoleMaxHeight : undefined
              }
              width={uiState.mainAreaWidth}
              hasFocus={uiState.showErrorDetails}
            />
            <ShowMoreLines constrainHeight={uiState.constrainHeight} />
          </Box>
        </OverflowProvider>
      )}

      {uiState.isInputActive && (
        <InputPrompt
          buffer={uiState.buffer}
          inputWidth={uiState.inputWidth}
          suggestionsWidth={uiState.suggestionsWidth}
          onSubmit={uiActions.handleFinalSubmit}
          userMessages={uiState.userMessages}
          setBannerVisible={uiActions.setBannerVisible}
          onClearScreen={uiActions.handleClearScreen}
          config={config}
          slashCommands={uiState.slashCommands || []}
          commandContext={uiState.commandContext}
          shellModeActive={uiState.shellModeActive}
          setShellModeActive={uiActions.setShellModeActive}
          approvalMode={showApprovalModeIndicator}
          onEscapePromptChange={uiActions.onEscapePromptChange}
          focus={isFocused}
          vimHandleInput={uiActions.vimHandleInput}
          isEmbeddedShellFocused={uiState.embeddedShellFocused}
          popAllMessages={uiActions.popAllMessages}
          placeholder={
            vimEnabled
              ? "  Press 'i' for INSERT mode and 'Esc' for NORMAL mode."
              : uiState.shellModeActive
                ? '  Type your shell command'
                : '  Type your message or @path/to/file'
          }
          setQueueErrorMessage={uiActions.setQueueErrorMessage}
          streamingState={uiState.streamingState}
          suggestionsPosition={suggestionsPosition}
          onSuggestionsVisibilityChange={setSuggestionsVisible}
        />
      )}

      {!settings.merged.ui.hideFooter && !isScreenReaderEnabled && <Footer />}
    </Box>
  );
};
