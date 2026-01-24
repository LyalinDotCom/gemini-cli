/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box } from 'ink';
import type { IndividualToolCallDisplay } from '../../types.js';
import { ToolResultDisplay } from './ToolResultDisplay.js';
import {
  type TextEmphasis,
  STATUS_INDICATOR_WIDTH,
  isThisShellFocusable as checkIsShellFocusable,
  isThisShellFocused as checkIsShellFocused,
  useFocusHint,
} from './ToolShared.js';
import { type Config } from '@google/gemini-cli-core';
import { ShellInputPrompt } from '../ShellInputPrompt.js';
import { MinimalToolHeader } from './MinimalToolHeader.js';
import { MinimalToolResult } from './MinimalToolResult.js';

export type { TextEmphasis };

export interface ToolMessageProps extends IndividualToolCallDisplay {
  availableTerminalHeight?: number;
  terminalWidth: number;
  emphasis?: TextEmphasis;
  renderOutputAsMarkdown?: boolean;
  isFirst: boolean;
  borderColor: string;
  borderDimColor: boolean;
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  ptyId?: number;
  config?: Config;
}

export const ToolMessage: React.FC<ToolMessageProps> = ({
  name,
  description,
  resultDisplay,
  status,
  availableTerminalHeight,
  terminalWidth,
  emphasis = 'medium',
  renderOutputAsMarkdown = true,
  activeShellPtyId,
  embeddedShellFocused,
  ptyId,
  config,
}) => {
  const isThisShellFocused = checkIsShellFocused(
    name,
    status,
    ptyId,
    activeShellPtyId,
    embeddedShellFocused,
  );

  const isThisShellFocusable = checkIsShellFocusable(name, status, config);

  const { shouldShowFocusHint } = useFocusHint(
    isThisShellFocusable,
    isThisShellFocused,
    resultDisplay,
  );

  const hasResult = resultDisplay !== undefined && resultDisplay !== '';

  return (
    <Box flexDirection="column" width={terminalWidth}>
      <MinimalToolHeader
        status={status}
        name={name}
        description={description}
        emphasis={emphasis}
        width={terminalWidth}
        showTrailingIndicator={emphasis === 'high'}
        shouldShowFocusHint={shouldShowFocusHint}
        isThisShellFocused={isThisShellFocused}
      />
      {hasResult && (
        <MinimalToolResult terminalWidth={terminalWidth}>
          <ToolResultDisplay
            resultDisplay={resultDisplay}
            availableTerminalHeight={availableTerminalHeight}
            terminalWidth={terminalWidth}
            renderOutputAsMarkdown={renderOutputAsMarkdown}
          />
        </MinimalToolResult>
      )}
      {isThisShellFocused && config && (
        <Box paddingLeft={STATUS_INDICATOR_WIDTH} marginTop={1}>
          <ShellInputPrompt
            activeShellPtyId={activeShellPtyId ?? null}
            focus={embeddedShellFocused}
          />
        </Box>
      )}
    </Box>
  );
};
