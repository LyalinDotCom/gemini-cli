/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from '../../test-utils/render.js';
import { Text } from 'ink';
import { LoadingIndicator } from './LoadingIndicator.js';
import { StreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState } from '../types.js';
import { vi } from 'vitest';
import * as useTerminalSize from '../hooks/useTerminalSize.js';

// Mock GeminiRespondingSpinner
vi.mock('./GeminiRespondingSpinner.js', () => ({
  GeminiRespondingSpinner: ({
    nonRespondingDisplay,
  }: {
    nonRespondingDisplay?: string;
  }) => {
    const streamingState = React.useContext(StreamingContext)!;
    if (streamingState === StreamingState.Responding) {
      return <Text>MockRespondingSpinner</Text>;
    } else if (nonRespondingDisplay) {
      return <Text>{nonRespondingDisplay}</Text>;
    }
    return null;
  },
}));

vi.mock('../hooks/useTerminalSize.js', () => ({
  useTerminalSize: vi.fn(),
}));

const useTerminalSizeMock = vi.mocked(useTerminalSize.useTerminalSize);

const renderWithContext = (
  ui: React.ReactElement,
  streamingStateValue: StreamingState,
  width = 120,
) => {
  useTerminalSizeMock.mockReturnValue({ columns: width, rows: 24 });
  const contextValue: StreamingState = streamingStateValue;
  return render(
    <StreamingContext.Provider value={contextValue}>
      {ui}
    </StreamingContext.Provider>,
    width,
  );
};

describe('<LoadingIndicator />', () => {
  const defaultProps = {
    currentLoadingPhrase: 'Loading...',
    elapsedTime: 5,
  };

  it('should render Ready status when streamingState is Idle', () => {
    const { lastFrame } = renderWithContext(
      <LoadingIndicator {...defaultProps} />,
      StreamingState.Idle,
    );
    const output = lastFrame();
    expect(output).toContain('Ready');
    expect(output).toContain('? for help');
  });

  it('should render spinner, phrase, and time when streamingState is Responding', () => {
    const { lastFrame } = renderWithContext(
      <LoadingIndicator {...defaultProps} />,
      StreamingState.Responding,
    );
    const output = lastFrame();
    expect(output).toContain('MockRespondingSpinner');
    expect(output).toContain('Loading...');
    expect(output).toContain('esc to cancel, 5s');
  });

  it('should render spinner (static), phrase but no time/cancel when streamingState is WaitingForConfirmation', () => {
    const props = {
      currentLoadingPhrase: 'Confirm action',
      elapsedTime: 10,
    };
    const { lastFrame } = renderWithContext(
      <LoadingIndicator {...props} />,
      StreamingState.WaitingForConfirmation,
    );
    const output = lastFrame();
    expect(output).toContain('⠏'); // Static char for WaitingForConfirmation
    expect(output).toContain('Confirm action');
    expect(output).not.toContain('(esc to cancel)');
    expect(output).not.toContain(', 10s');
  });

  it('should display the currentLoadingPhrase correctly', () => {
    const props = {
      currentLoadingPhrase: 'Processing data...',
      elapsedTime: 3,
    };
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator {...props} />,
      StreamingState.Responding,
    );
    expect(lastFrame()).toContain('Processing data...');
    unmount();
  });

  it('should display the elapsedTime correctly when Responding', () => {
    const props = {
      currentLoadingPhrase: 'Working...',
      elapsedTime: 60,
    };
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator {...props} />,
      StreamingState.Responding,
    );
    expect(lastFrame()).toContain('esc to cancel, 1m');
    unmount();
  });

  it('should display the elapsedTime correctly in human-readable format', () => {
    const props = {
      currentLoadingPhrase: 'Working...',
      elapsedTime: 125,
    };
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator {...props} />,
      StreamingState.Responding,
    );
    expect(lastFrame()).toContain('esc to cancel, 2m 5s');
    unmount();
  });

  it('should render rightContent when provided', () => {
    const rightContent = <Text>Extra Info</Text>;
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator {...defaultProps} rightContent={rightContent} />,
      StreamingState.Responding,
    );
    expect(lastFrame()).toContain('Extra Info');
    unmount();
  });

  it('should transition correctly between states using rerender', () => {
    const { lastFrame, rerender, unmount } = renderWithContext(
      <LoadingIndicator {...defaultProps} />,
      StreamingState.Idle,
    );
    let output = lastFrame();
    expect(output).toContain('Ready'); // Initial: Idle shows Ready
    expect(output).toContain('? for help');

    // Transition to Responding
    rerender(
      <StreamingContext.Provider value={StreamingState.Responding}>
        <LoadingIndicator
          currentLoadingPhrase="Now Responding"
          elapsedTime={2}
        />
      </StreamingContext.Provider>,
    );
    output = lastFrame();
    expect(output).toContain('MockRespondingSpinner');
    expect(output).toContain('Now Responding');
    expect(output).toContain('esc to cancel, 2s');

    // Transition to WaitingForConfirmation
    rerender(
      <StreamingContext.Provider value={StreamingState.WaitingForConfirmation}>
        <LoadingIndicator
          currentLoadingPhrase="Please Confirm"
          elapsedTime={15}
        />
      </StreamingContext.Provider>,
    );
    output = lastFrame();
    expect(output).toContain('⠏');
    expect(output).toContain('Please Confirm');
    expect(output).not.toContain('esc to cancel');
    expect(output).not.toContain(', 15s');

    // Transition back to Idle
    rerender(
      <StreamingContext.Provider value={StreamingState.Idle}>
        <LoadingIndicator {...defaultProps} />
      </StreamingContext.Provider>,
    );
    output = lastFrame();
    expect(output).toContain('Ready');
    expect(output).toContain('? for help');
    unmount();
  });

  it('should display tool status message when provided', () => {
    const props = {
      currentLoadingPhrase: 'reading file.ts',
      elapsedTime: 5,
    };
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator {...props} />,
      StreamingState.Responding,
    );
    const output = lastFrame();
    expect(output).toContain('reading file.ts');
    unmount();
  });

  it('should truncate long primary text instead of wrapping', () => {
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator
        {...defaultProps}
        currentLoadingPhrase={
          'This is an extremely long loading phrase that should be truncated in the UI to keep the primary line concise.'
        }
      />,
      StreamingState.Responding,
      80,
    );

    expect(lastFrame()).toMatchSnapshot();
    unmount();
  });

  describe('responsive layout', () => {
    it('should render all elements on a wide terminal', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator
          {...defaultProps}
          rightContent={<Text>Right</Text>}
        />,
        StreamingState.Responding,
        120,
      );
      const output = lastFrame();
      expect(output).toContain('Loading...');
      expect(output).toContain('esc to cancel, 5s');
      expect(output).toContain('Right');
      unmount();
    });

    it('should render with right content below on a narrow terminal', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator
          {...defaultProps}
          rightContent={<Text>Right</Text>}
        />,
        StreamingState.Responding,
        79,
      );
      const output = lastFrame();
      expect(output).toContain('Loading...');
      expect(output).toContain('esc to cancel, 5s');
      expect(output).toContain('Right');
      unmount();
    });

    it('should render at 80 columns', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator {...defaultProps} />,
        StreamingState.Responding,
        80,
      );
      const output = lastFrame();
      expect(output).toContain('Loading...');
      expect(output).toContain('esc to cancel, 5s');
      unmount();
    });

    it('should render at 79 columns', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator {...defaultProps} />,
        StreamingState.Responding,
        79,
      );
      const output = lastFrame();
      expect(output).toContain('Loading...');
      expect(output).toContain('esc to cancel, 5s');
      unmount();
    });
  });

  it('should show Ready when idle', () => {
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator {...defaultProps} />,
      StreamingState.Idle,
    );
    const output = lastFrame();
    expect(output).toContain('Ready');
    expect(output).not.toContain('YOLO');
    unmount();
  });
});
