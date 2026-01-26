/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

/**
 * Hook to manage user hint buffer during tool execution.
 * Allows users to type hints while tools are executing, which are then
 * bundled as text parts alongside function responses when sent back to Gemini.
 */
export function useUserHintBuffer() {
  const [hintBuffer, setHintBuffer] = useState('');

  const appendToHintBuffer = useCallback((text: string) => {
    setHintBuffer((prev) => prev + text);
  }, []);

  const replaceHintBuffer = useCallback((text: string) => {
    setHintBuffer(text);
  }, []);

  const clearHintBuffer = useCallback(() => {
    setHintBuffer('');
  }, []);

  const consumeHintBuffer = useCallback(() => {
    const hint = hintBuffer;
    setHintBuffer('');
    return hint;
  }, [hintBuffer]);

  const removeLastCharFromHintBuffer = useCallback(() => {
    setHintBuffer((prev) => prev.slice(0, -1));
  }, []);

  return {
    hintBuffer,
    appendToHintBuffer,
    replaceHintBuffer,
    clearHintBuffer,
    consumeHintBuffer,
    removeLastCharFromHintBuffer,
    hasHint: hintBuffer.length > 0,
  };
}
