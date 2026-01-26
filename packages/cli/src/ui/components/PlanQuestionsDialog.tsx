/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from './shared/TextInput.js';
import { useTextBuffer } from './shared/text-buffer.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import type { PlanQuestionsRequest } from '../types.js';
import { useUIState } from '../contexts/UIStateContext.js';

interface PlanQuestionsDialogProps {
  request: PlanQuestionsRequest;
}

export function PlanQuestionsDialog({ request }: PlanQuestionsDialogProps) {
  const { mainAreaWidth } = useUIState();
  const viewportWidth = Math.max(mainAreaWidth - 10, 40);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(
    Array.from({ length: request.questions.length }, () => ''),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buffer = useTextBuffer({
    initialText: '',
    initialCursorOffset: 0,
    viewport: {
      width: viewportWidth,
      height: 3,
    },
    isValidPath: () => false,
    singleLine: false,
  });

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        request.onCancel();
      }
    },
    { isActive: true },
  );

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setErrorMessage('Please answer before continuing.');
      return;
    }

    const nextAnswers = [...answers];
    nextAnswers[currentIndex] = trimmed;
    setAnswers(nextAnswers);
    setErrorMessage(null);

    if (currentIndex >= request.questions.length - 1) {
      request.onSubmit(nextAnswers);
      return;
    }

    buffer.setText('');
    setCurrentIndex((index) => index + 1);
  };

  const currentQuestion = request.questions[currentIndex];

  return (
    <Box width="100%" flexDirection="row">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.text.link}
        flexGrow={1}
        marginLeft={1}
      >
        <Box paddingX={1} paddingY={0} flexDirection="column">
          <Text color={theme.text.primary} bold>
            {request.title}
          </Text>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              Question {currentIndex + 1} of {request.questions.length}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.primary}>{currentQuestion}</Text>
          </Box>
          <Box
            marginTop={1}
            borderStyle="round"
            borderColor={theme.border.focused}
            paddingX={1}
          >
            <TextInput
              buffer={buffer}
              onSubmit={handleSubmit}
              onCancel={request.onCancel}
              placeholder="Type your answer and press Enter..."
            />
          </Box>
          {errorMessage && (
            <Box marginTop={1}>
              <Text color={theme.status.error}>{errorMessage}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              Press Enter to continue, Esc to cancel
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
