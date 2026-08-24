/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from '../../../test-utils/render.js';
import { Text } from 'ink';
import { LoadingIndicator } from './loading-indicator.js';
import { StreamingContext } from '../../contexts/streaming-context.js';
import { StreamingState } from '../../types.js';
import { vi } from 'vitest';
import * as useTerminalSize from '../../hooks/terminal/use-terminal-size.js';

// Mock AgentRespondingSpinner
vi.mock('./agent-responding-spinner.js', () => ({
  AgentRespondingSpinner: ({
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

vi.mock('../../hooks/terminal/use-terminal-size.js', () => ({
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

  it('should not render when streamingState is Idle', () => {
    const { lastFrame } = renderWithContext(
      <LoadingIndicator {...defaultProps} />,
      StreamingState.Idle,
    );
    expect(lastFrame()).toBe('');
  });

  it('should render spinner, phrase, and time when streamingState is Responding', () => {
    const { lastFrame } = renderWithContext(
      <LoadingIndicator {...defaultProps} />,
      StreamingState.Responding,
    );
    const output = lastFrame();
    expect(output).toContain('MockRespondingSpinner');
    expect(output).toContain('Loading...');
    expect(output).toContain('(esc to cancel, 5s)');
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
    expect(lastFrame()).toContain('(esc to cancel, 1m)');
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
    expect(lastFrame()).toContain('(esc to cancel, 2m 5s)');
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
    expect(lastFrame()).toBe(''); // Initial: Idle

    // Transition to Responding
    rerender(
      <StreamingContext.Provider value={StreamingState.Responding}>
        <LoadingIndicator
          currentLoadingPhrase="Now Responding"
          elapsedTime={2}
        />
      </StreamingContext.Provider>,
    );
    const output = lastFrame();
    expect(output).toContain('MockRespondingSpinner');
    expect(output).toContain('Now Responding');
    expect(output).toContain('(esc to cancel, 2s)');

    // Transition back to Idle
    rerender(
      <StreamingContext.Provider value={StreamingState.Idle}>
        <LoadingIndicator {...defaultProps} />
      </StreamingContext.Provider>,
    );
    expect(lastFrame()).toBe('');
    unmount();
  });

  it('should display the current loading phrase', () => {
    const props = {
      currentLoadingPhrase: 'Loading...',
      elapsedTime: 5,
    };
    const { lastFrame, unmount } = renderWithContext(
      <LoadingIndicator {...props} />,
      StreamingState.Responding,
    );
    const output = lastFrame();
    expect(output).toContain('Loading...');
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
    it('should render on a single line on a wide terminal', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator
          {...defaultProps}
          rightContent={<Text>Right</Text>}
        />,
        StreamingState.Responding,
        120,
      );
      const output = lastFrame();
      // Check for single line output
      expect(output?.includes('\n')).toBe(false);
      expect(output).toContain('Loading...');
      expect(output).toContain('(esc to cancel, 5s)');
      expect(output).toContain('Right');
      unmount();
    });

    it('should render on multiple lines on a narrow terminal', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator
          {...defaultProps}
          rightContent={<Text>Right</Text>}
        />,
        StreamingState.Responding,
        79,
      );
      const output = lastFrame();
      const lines = output?.split('\n');
      // Expecting 3 lines:
      // 1. Spinner + Primary Text
      // 2. Cancel + Timer
      // 3. Right Content
      expect(lines).toHaveLength(3);
      expect(lines?.[0]).toContain('Loading...');
      expect(lines?.[0]).not.toContain('(esc to cancel, 5s)');
      expect(lines?.[1]).toContain('(esc to cancel, 5s)');
      expect(lines?.[2]).toContain('Right');
      unmount();
    });

    it('should use wide layout at 80 columns', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator {...defaultProps} />,
        StreamingState.Responding,
        80,
      );
      expect(lastFrame()?.includes('\n')).toBe(false);
      unmount();
    });

    it('should use narrow layout at 79 columns', () => {
      const { lastFrame, unmount } = renderWithContext(
        <LoadingIndicator {...defaultProps} />,
        StreamingState.Responding,
        79,
      );
      expect(lastFrame()?.includes('\n')).toBe(true);
      unmount();
    });
  });
});
