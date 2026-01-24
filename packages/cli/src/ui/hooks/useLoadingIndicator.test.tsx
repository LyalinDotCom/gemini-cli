/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render } from '../../test-utils/render.js';
import {
  useLoadingIndicator,
  INTERACTIVE_SHELL_WAITING_PHRASE,
} from './useLoadingIndicator.js';
import { StreamingState } from '../types.js';
import type {
  RetryAttemptPayload,
  ThoughtSummary,
  Config,
} from '@google/gemini-cli-core';
import type { TrackedToolCall } from './useToolScheduler.js';

// Mock config for testing
const mockConfig = {
  getGeminiClient: () => null,
} as unknown as Config;

describe('useLoadingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(() => vi.runOnlyPendingTimers);
    vi.restoreAllMocks();
  });

  const renderLoadingIndicatorHook = (
    initialStreamingState: StreamingState,
    options: {
      shouldShowFocusHint?: boolean;
      retryStatus?: RetryAttemptPayload | null;
      pendingToolCalls?: TrackedToolCall[];
      thought?: ThoughtSummary | null;
      config?: Config;
    } = {},
  ) => {
    let hookResult: ReturnType<typeof useLoadingIndicator>;
    function TestComponent(props: {
      streamingState: StreamingState;
      shouldShowFocusHint?: boolean;
      retryStatus?: RetryAttemptPayload | null;
      pendingToolCalls?: TrackedToolCall[];
      thought?: ThoughtSummary | null;
      config?: Config;
    }) {
      hookResult = useLoadingIndicator({
        streamingState: props.streamingState,
        shouldShowFocusHint: props.shouldShowFocusHint ?? false,
        retryStatus: props.retryStatus ?? null,
        pendingToolCalls: props.pendingToolCalls,
        thought: props.thought,
        config: props.config ?? mockConfig,
      });
      return null;
    }
    const { rerender } = render(
      <TestComponent
        streamingState={initialStreamingState}
        shouldShowFocusHint={options.shouldShowFocusHint}
        retryStatus={options.retryStatus}
        pendingToolCalls={options.pendingToolCalls}
        thought={options.thought}
        config={options.config}
      />,
    );
    return {
      result: {
        get current() {
          return hookResult;
        },
      },
      rerender: (newProps: {
        streamingState: StreamingState;
        shouldShowFocusHint?: boolean;
        retryStatus?: RetryAttemptPayload | null;
        pendingToolCalls?: TrackedToolCall[];
        thought?: ThoughtSummary | null;
        config?: Config;
      }) => rerender(<TestComponent {...newProps} />),
    };
  };

  it('should initialize with "Thinking..." when Idle with no context', () => {
    const { result } = renderLoadingIndicatorHook(StreamingState.Idle);
    expect(result.current.elapsedTime).toBe(0);
    expect(result.current.currentLoadingPhrase).toBe('Thinking...');
  });

  it('should show interactive shell waiting phrase when shouldShowFocusHint is true', async () => {
    const { result, rerender } = renderLoadingIndicatorHook(
      StreamingState.Responding,
      { shouldShowFocusHint: false },
    );

    // Initially should be "Thinking..."
    expect(result.current.currentLoadingPhrase).toBe('Thinking...');

    await act(async () => {
      rerender({
        streamingState: StreamingState.Responding,
        shouldShowFocusHint: true,
      });
    });

    expect(result.current.currentLoadingPhrase).toBe(
      INTERACTIVE_SHELL_WAITING_PHRASE,
    );
  });

  it('should show "Thinking..." when Responding with no tool calls', async () => {
    const { result } = renderLoadingIndicatorHook(StreamingState.Responding);

    expect(result.current.elapsedTime).toBe(0);
    expect(result.current.currentLoadingPhrase).toBe('Thinking...');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.elapsedTime).toBe(5);
    expect(result.current.currentLoadingPhrase).toBe('Thinking...');
  });

  it('should show tool status when tools are executing', async () => {
    const mockToolCall = {
      request: {
        callId: 'test-1',
        name: 'read_file',
        args: { file_path: '/path/to/file.ts' },
      },
      status: 'executing',
    } as unknown as TrackedToolCall;

    const { result } = renderLoadingIndicatorHook(StreamingState.Responding, {
      pendingToolCalls: [mockToolCall],
    });

    expect(result.current.currentLoadingPhrase).toBe('reading file.ts');
  });

  it('should show confirmation message when tools are awaiting approval', async () => {
    const mockToolCall = {
      request: {
        callId: 'test-1',
        name: 'write_file',
        args: { file_path: '/path/to/output.ts' },
      },
      status: 'awaiting_approval',
    } as unknown as TrackedToolCall;

    const { result } = renderLoadingIndicatorHook(
      StreamingState.WaitingForConfirmation,
      { pendingToolCalls: [mockToolCall] },
    );

    expect(result.current.currentLoadingPhrase).toBe(
      'confirm: writing output.ts',
    );
  });

  it('should show waiting phrase and retain elapsedTime when WaitingForConfirmation', async () => {
    const { result, rerender } = renderLoadingIndicatorHook(
      StreamingState.Responding,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(result.current.elapsedTime).toBe(60);

    act(() => {
      rerender({ streamingState: StreamingState.WaitingForConfirmation });
    });

    expect(result.current.currentLoadingPhrase).toBe(
      'Waiting for user confirmation...',
    );
    expect(result.current.elapsedTime).toBe(60);

    // Timer should not advance further
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.elapsedTime).toBe(60);
  });

  it('should reset elapsedTime when transitioning from WaitingForConfirmation to Responding', async () => {
    const { result, rerender } = renderLoadingIndicatorHook(
      StreamingState.Responding,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.elapsedTime).toBe(5);

    act(() => {
      rerender({ streamingState: StreamingState.WaitingForConfirmation });
    });
    expect(result.current.elapsedTime).toBe(5);

    act(() => {
      rerender({ streamingState: StreamingState.Responding });
    });
    expect(result.current.elapsedTime).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.elapsedTime).toBe(1);
  });

  it('should reset timer when streamingState changes from Responding to Idle', async () => {
    const { result, rerender } = renderLoadingIndicatorHook(
      StreamingState.Responding,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(result.current.elapsedTime).toBe(10);

    act(() => {
      rerender({ streamingState: StreamingState.Idle });
    });

    expect(result.current.elapsedTime).toBe(0);

    // Timer should not advance
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.elapsedTime).toBe(0);
  });

  it('should reflect retry status in currentLoadingPhrase when provided', () => {
    const retryStatus: RetryAttemptPayload = {
      model: 'gemini-pro',
      attempt: 2,
      maxAttempts: 3,
      delayMs: 1000,
    };
    const { result } = renderLoadingIndicatorHook(StreamingState.Responding, {
      retryStatus,
    });

    expect(result.current.currentLoadingPhrase).toContain('Trying to reach');
    expect(result.current.currentLoadingPhrase).toContain('Attempt 3/3');
  });

  it('should prioritize retry status over tool status', () => {
    const retryStatus: RetryAttemptPayload = {
      model: 'gemini-pro',
      attempt: 1,
      maxAttempts: 3,
      delayMs: 1000,
    };
    const mockToolCall = {
      request: {
        callId: 'test-1',
        name: 'read_file',
        args: { file_path: '/path/to/file.ts' },
      },
      status: 'executing',
    } as unknown as TrackedToolCall;

    const { result } = renderLoadingIndicatorHook(StreamingState.Responding, {
      retryStatus,
      pendingToolCalls: [mockToolCall],
    });

    expect(result.current.currentLoadingPhrase).toContain('Trying to reach');
  });

  it('should show thought subject when provided and no tools executing', () => {
    const thought: ThoughtSummary = {
      subject: 'analyzing code patterns',
      description: 'Looking at the code patterns in the project...',
    };

    const { result } = renderLoadingIndicatorHook(StreamingState.Responding, {
      thought,
    });

    // Since description is < 100 chars, it will use subject directly
    expect(result.current.currentLoadingPhrase).toBe('analyzing code patterns');
  });

  it('should show multiple tools message for concurrent tool calls', () => {
    const mockToolCalls = [
      {
        request: {
          callId: 'test-1',
          name: 'read_file',
          args: { file_path: '/path/to/a.ts' },
        },
        status: 'executing',
      },
      {
        request: {
          callId: 'test-2',
          name: 'read_file',
          args: { file_path: '/path/to/b.ts' },
        },
        status: 'executing',
      },
    ] as unknown as TrackedToolCall[];

    const { result } = renderLoadingIndicatorHook(StreamingState.Responding, {
      pendingToolCalls: mockToolCalls,
    });

    expect(result.current.currentLoadingPhrase).toBe('reading a.ts (+1 more)');
  });
});
