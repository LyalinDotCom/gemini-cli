/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export default function InputBox({ onSubmit, disabled }: InputBoxProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasDisabledRef = useRef(disabled);

  // Auto-focus when connection is established (disabled -> enabled)
  useEffect(() => {
    if (wasDisabledRef.current && !disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
    wasDisabledRef.current = disabled;
  }, [disabled]);

  const handleSubmit = useCallback(() => {
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      // Auto-resize textarea
      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    },
    [],
  );

  return (
    <div className="input-container">
      <div className="input-box">
        <span className="input-prefix">&gt;</span>
        <textarea
          ref={textareaRef}
          className="input-textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message or @path/to/file..."
          disabled={disabled}
          rows={1}
        />
      </div>
    </div>
  );
}
