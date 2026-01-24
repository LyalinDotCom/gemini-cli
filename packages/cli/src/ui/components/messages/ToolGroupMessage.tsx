/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { IndividualToolCallDisplay } from '../../types.js';
import { ToolCallStatus } from '../../types.js';
import { ToolMessage } from './ToolMessage.js';
import { ShellToolMessage } from './ShellToolMessage.js';
import { ToolConfirmationMessage } from './ToolConfirmationMessage.js';
import { theme } from '../../semantic-colors.js';
import { useConfig } from '../../contexts/ConfigContext.js';
import {
  isShellTool,
  isThisShellFocused,
  STATUS_INDICATOR_WIDTH,
} from './ToolShared.js';
import { MinimalToolResult } from './MinimalToolResult.js';

interface ToolGroupMessageProps {
  groupId: number;
  toolCalls: IndividualToolCallDisplay[];
  availableTerminalHeight?: number;
  terminalWidth: number;
  isFocused?: boolean;
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  onShellInputSubmit?: (input: string) => void;
}

// Main component renders tools without borders, using blank line separators
export const ToolGroupMessage: React.FC<ToolGroupMessageProps> = ({
  toolCalls,
  availableTerminalHeight,
  terminalWidth,
  isFocused = true,
  activeShellPtyId,
  embeddedShellFocused,
}) => {
  const config = useConfig();

  const isEventDriven = config.isEventDrivenSchedulerEnabled();

  // If Event-Driven Scheduler is enabled, we HIDE tools that are still in
  // pre-execution states (Confirming, Pending) from the History log.
  // They live in the Global Queue or wait for their turn.
  const visibleToolCalls = useMemo(() => {
    if (!isEventDriven) {
      return toolCalls;
    }
    // Only show tools that are actually running or finished.
    // We explicitly exclude Pending and Confirming to ensure they only
    // appear in the Global Queue until they are approved and start executing.
    return toolCalls.filter(
      (t) =>
        t.status !== ToolCallStatus.Pending &&
        t.status !== ToolCallStatus.Confirming,
    );
  }, [toolCalls, isEventDriven]);

  const isEmbeddedShellFocused = visibleToolCalls.some((t) =>
    isThisShellFocused(
      t.name,
      t.status,
      t.ptyId,
      activeShellPtyId,
      embeddedShellFocused,
    ),
  );

  const hasPending = !visibleToolCalls.every(
    (t) => t.status === ToolCallStatus.Success,
  );

  const isShellCommand = toolCalls.some((t) => isShellTool(t.name));
  const borderColor =
    (isShellCommand && hasPending) || isEmbeddedShellFocused
      ? theme.ui.symbol
      : hasPending
        ? theme.status.warning
        : theme.border.default;

  const borderDimColor =
    hasPending && (!isShellCommand || !isEmbeddedShellFocused);

  const staticHeight = /* blank line separators */ visibleToolCalls.length - 1;

  // Inline confirmations are ONLY used when the Global Queue is disabled.
  const toolAwaitingApproval = useMemo(
    () =>
      isEventDriven
        ? undefined
        : toolCalls.find((tc) => tc.status === ToolCallStatus.Confirming),
    [toolCalls, isEventDriven],
  );

  // If all tools are hidden (e.g. group only contains confirming or pending tools),
  // render nothing in the history log.
  if (visibleToolCalls.length === 0) {
    return null;
  }

  let countToolCallsWithResults = 0;
  for (const tool of visibleToolCalls) {
    if (tool.resultDisplay !== undefined && tool.resultDisplay !== '') {
      countToolCallsWithResults++;
    }
  }
  const countOneLineToolCalls =
    visibleToolCalls.length - countToolCallsWithResults;
  const availableTerminalHeightPerToolMessage = availableTerminalHeight
    ? Math.max(
        Math.floor(
          (availableTerminalHeight - staticHeight - countOneLineToolCalls) /
            Math.max(1, countToolCallsWithResults),
        ),
        1,
      )
    : undefined;

  // Left margin for visual separation from edge
  const LEFT_MARGIN = 2;

  return (
    <Box
      flexDirection="column"
      width={terminalWidth}
      marginTop={1}
      marginBottom={1}
      paddingLeft={LEFT_MARGIN}
    >
      {visibleToolCalls.map((tool, index) => {
        const isConfirming = toolAwaitingApproval?.callId === tool.callId;
        const isFirst = index === 0;
        const isShellToolCall = isShellTool(tool.name);

        // Adjust width for left margin
        const contentWidth = terminalWidth - LEFT_MARGIN;

        const commonProps = {
          ...tool,
          availableTerminalHeight: availableTerminalHeightPerToolMessage,
          terminalWidth: contentWidth,
          emphasis: isConfirming
            ? ('high' as const)
            : toolAwaitingApproval
              ? ('low' as const)
              : ('medium' as const),
          isFirst,
          borderColor,
          borderDimColor,
        };

        return (
          <Box
            key={tool.callId}
            flexDirection="column"
            minHeight={1}
            width={contentWidth}
            marginTop={index > 0 ? 1 : 0}
          >
            {isShellToolCall ? (
              <ShellToolMessage
                {...commonProps}
                activeShellPtyId={activeShellPtyId}
                embeddedShellFocused={embeddedShellFocused}
                config={config}
              />
            ) : (
              <ToolMessage {...commonProps} />
            )}
            {/* Inline confirmation - indented under the tool */}
            {tool.status === ToolCallStatus.Confirming &&
              isConfirming &&
              tool.confirmationDetails && (
                <MinimalToolResult terminalWidth={contentWidth}>
                  <ToolConfirmationMessage
                    callId={tool.callId}
                    confirmationDetails={tool.confirmationDetails}
                    config={config}
                    isFocused={isFocused}
                    availableTerminalHeight={
                      availableTerminalHeightPerToolMessage
                    }
                    terminalWidth={contentWidth - STATUS_INDICATOR_WIDTH}
                  />
                </MinimalToolResult>
              )}
            {/* Output file notice - indented */}
            {tool.outputFile && (
              <MinimalToolResult terminalWidth={contentWidth}>
                <Text color={theme.text.primary}>
                  Output too long and was saved to: {tool.outputFile}
                </Text>
              </MinimalToolResult>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
