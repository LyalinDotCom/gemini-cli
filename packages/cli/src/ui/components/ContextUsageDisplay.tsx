/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme } from '../semantic-colors.js';
import { tokenLimit } from '@google/gemini-cli-core';
import { useState, useEffect, useRef } from 'react';
import type { SessionStatsState } from '../contexts/SessionContext.js';

export const ContextUsageDisplay = ({
  promptTokenCount,
  model,
  terminalWidth,
  showTokenCounts = false,
  sessionStats,
}: {
  promptTokenCount: number;
  model: string;
  terminalWidth: number;
  showTokenCounts?: boolean;
  sessionStats?: SessionStatsState;
}) => {
  const [animatedInputTokens, setAnimatedInputTokens] = useState(0);
  const [animatedOutputTokens, setAnimatedOutputTokens] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousInputRef = useRef(0);
  const previousOutputRef = useRef(0);

  // Get current token counts from session stats
  const modelMetrics = sessionStats?.metrics?.models?.[model];
  const currentInputTokens = modelMetrics?.tokens?.prompt ?? 0;
  const currentOutputTokens = modelMetrics?.tokens?.candidates ?? 0;

  // Animate tokens counting up when they change
  useEffect(() => {
    if (!showTokenCounts) return;

    const prevInput = previousInputRef.current;
    const prevOutput = previousOutputRef.current;

    if (
      prevInput === currentInputTokens &&
      prevOutput === currentOutputTokens
    ) {
      return;
    }

    // Start animation
    setIsAnimating(true);
    setAnimatedInputTokens(prevInput);
    setAnimatedOutputTokens(prevOutput);

    const inputDiff = currentInputTokens - prevInput;
    const outputDiff = currentOutputTokens - prevOutput;
    const steps = 30; // Increased for smoother animation
    const duration = 800; // Slower animation (was 300ms)
    const stepDuration = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      // Ease-out animation for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedInputTokens(Math.round(prevInput + inputDiff * easeProgress));
      setAnimatedOutputTokens(
        Math.round(prevOutput + outputDiff * easeProgress),
      );

      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedInputTokens(currentInputTokens);
        setAnimatedOutputTokens(currentOutputTokens);
        previousInputRef.current = currentInputTokens;
        previousOutputRef.current = currentOutputTokens;

        // Keep glow for an extra second after animation completes
        setTimeout(() => {
          setIsAnimating(false);
        }, 1000);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [currentInputTokens, currentOutputTokens, showTokenCounts]);

  // Update refs when switching modes
  useEffect(() => {
    if (showTokenCounts) {
      previousInputRef.current = currentInputTokens;
      previousOutputRef.current = currentOutputTokens;
      setAnimatedInputTokens(currentInputTokens);
      setAnimatedOutputTokens(currentOutputTokens);
    }
  }, [showTokenCounts, currentInputTokens, currentOutputTokens]);

  if (showTokenCounts) {
    const tokenText = `((I) ${animatedInputTokens.toLocaleString()} (O) ${animatedOutputTokens.toLocaleString()})`;

    // Show gradient glow during animation, fade back to gray after
    if (isAnimating) {
      return (
        <Gradient colors={theme.ui.gradient}>
          <Text>{tokenText}</Text>
        </Gradient>
      );
    }

    return <Text color={theme.text.secondary}>{tokenText}</Text>;
  }

  // Default: show context percentage
  const percentage = promptTokenCount / tokenLimit(model);
  const percentageLeft = ((1 - percentage) * 100).toFixed(0);
  const label = terminalWidth < 100 ? '%' : '% context left';

  return (
    <Text color={theme.text.secondary}>
      ({percentageLeft}
      {label})
    </Text>
  );
};
