/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, type DOMElement } from 'ink';
import { ShellInputPrompt } from '../ShellInputPrompt.js';
import { useUIActions } from '../../contexts/UIActionsContext.js';
import { useMouseClick } from '../../hooks/useMouseClick.js';
import { ToolResultDisplay } from './ToolResultDisplay.js';
import {
  STATUS_INDICATOR_WIDTH,
  isThisShellFocusable as checkIsShellFocusable,
  isThisShellFocused as checkIsShellFocused,
  useFocusHint,
} from './ToolShared.js';
import type { ToolMessageProps } from './ToolMessage.js';
import type { Config } from '@google/gemini-cli-core';
import { MinimalToolHeader } from './MinimalToolHeader.js';
import { MinimalToolResult } from './MinimalToolResult.js';

export interface ShellToolMessageProps extends ToolMessageProps {
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  config?: Config;
}

export const ShellToolMessage: React.FC<ShellToolMessageProps> = ({
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

  const { setEmbeddedShellFocused } = useUIActions();

  const headerRef = React.useRef<DOMElement>(null);
  const contentRef = React.useRef<DOMElement>(null);

  // The shell is focusable if it's the shell command, it's executing, and the interactive shell is enabled.
  const isThisShellFocusable = checkIsShellFocusable(name, status, config);

  const handleFocus = () => {
    if (isThisShellFocusable) {
      setEmbeddedShellFocused(true);
    }
  };

  useMouseClick(headerRef, handleFocus, { isActive: !!isThisShellFocusable });
  useMouseClick(contentRef, handleFocus, { isActive: !!isThisShellFocusable });

  const wasFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (isThisShellFocused) {
      wasFocusedRef.current = true;
    } else if (wasFocusedRef.current) {
      if (embeddedShellFocused) {
        setEmbeddedShellFocused(false);
      }
      wasFocusedRef.current = false;
    }
  }, [isThisShellFocused, embeddedShellFocused, setEmbeddedShellFocused]);

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
        containerRef={headerRef}
      />
      {hasResult && (
        <Box ref={contentRef}>
          <MinimalToolResult terminalWidth={terminalWidth}>
            <ToolResultDisplay
              resultDisplay={resultDisplay}
              availableTerminalHeight={availableTerminalHeight}
              terminalWidth={terminalWidth}
              renderOutputAsMarkdown={renderOutputAsMarkdown}
            />
          </MinimalToolResult>
        </Box>
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
