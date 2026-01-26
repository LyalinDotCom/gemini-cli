/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { ApprovalMode } from '@google/gemini-cli-core';

interface ApprovalModeIndicatorProps {
  approvalMode: ApprovalMode;
}

export const ApprovalModeIndicator: React.FC<ApprovalModeIndicatorProps> = ({
  approvalMode,
}) => {
  let textColor = '';
  let textContent = '';
  let subText = '';
  let customContent: React.ReactNode | null = null;

  switch (approvalMode) {
    case ApprovalMode.AUTO_EDIT:
      textColor = theme.status.warning;
      textContent = 'accepting edits';
      subText = ' (shift + tab to cycle)';
      break;
    case ApprovalMode.PLAN:
      textColor = theme.status.success;
      textContent = 'plan mode';
      subText = ' (shift + tab to cycle)';
      break;
    case ApprovalMode.YOLO:
      textColor = theme.status.error;
      customContent = (
        <>
          <Text color={theme.status.error}>YOLO</Text>
          <Text color={theme.text.secondary}> | </Text>
          <Text color={theme.status.warning}>accepting edits</Text>
        </>
      );
      subText = ' (ctrl + y to toggle)';
      break;
    case ApprovalMode.DEFAULT:
    default:
      break;
  }

  return (
    <Box>
      {customContent ? (
        <Text>
          {customContent}
          {subText && <Text color={theme.text.secondary}>{subText}</Text>}
        </Text>
      ) : (
        <Text color={textColor}>
          {textContent}
          {subText && <Text color={theme.text.secondary}>{subText}</Text>}
        </Text>
      )}
    </Box>
  );
};
