/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, type DOMElement } from 'ink';
import type { ToolCallStatus } from '../../types.js';
import {
  ToolStatusIndicator,
  ToolInfo,
  TrailingIndicator,
  type TextEmphasis,
  FocusHint,
} from './ToolShared.js';
import { theme } from '../../semantic-colors.js';

export interface MinimalToolHeaderProps {
  status: ToolCallStatus;
  name: string;
  description: string;
  emphasis?: TextEmphasis;
  width: number;
  showTrailingIndicator?: boolean;
  shouldShowFocusHint?: boolean;
  isThisShellFocused?: boolean;
  containerRef?: React.RefObject<DOMElement | null>;
}

export const MinimalToolHeader: React.FC<MinimalToolHeaderProps> = ({
  status,
  name,
  description,
  emphasis = 'medium',
  width,
  showTrailingIndicator = false,
  shouldShowFocusHint = false,
  isThisShellFocused = false,
  containerRef,
}) => (
  <Box
    ref={containerRef}
    sticky
    minHeight={1}
    flexShrink={0}
    width={width}
    stickyChildren={
      <Box flexDirection="column" width={width} opaque>
        <Box>
          <ToolStatusIndicator status={status} name={name} />
          <ToolInfo
            name={name}
            status={status}
            description={description}
            emphasis={emphasis}
          />
          <FocusHint
            shouldShowFocusHint={shouldShowFocusHint}
            isThisShellFocused={isThisShellFocused}
          />
          {showTrailingIndicator && <TrailingIndicator />}
        </Box>
        {/* Thin separator line when sticky */}
        <Box
          width={width}
          borderColor={theme.ui.dark}
          borderStyle="single"
          borderTop={false}
          borderBottom={true}
          borderLeft={false}
          borderRight={false}
        />
      </Box>
    }
  >
    <Box width={width}>
      <ToolStatusIndicator status={status} name={name} />
      <ToolInfo
        name={name}
        status={status}
        description={description}
        emphasis={emphasis}
      />
      <FocusHint
        shouldShowFocusHint={shouldShowFocusHint}
        isThisShellFocused={isThisShellFocused}
      />
      {showTrailingIndicator && <TrailingIndicator />}
    </Box>
  </Box>
);
