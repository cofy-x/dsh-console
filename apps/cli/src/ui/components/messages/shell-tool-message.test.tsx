/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { act } from 'react';
import {
  ShellToolMessage,
  type ShellToolMessageProps,
} from './shell-tool-message.js';
import { StreamingState, ToolCallStatus } from '../../types.js';
import { Text } from 'ink';
import type { Config } from '../../../config/config.js';
import { renderWithProviders } from '../../../test-utils/render.js';
import { waitFor } from '../../../test-utils/async.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SHELL_TOOL_NAME } from '../../../config/shell.js';
import { SHELL_COMMAND_NAME } from '../../constants.js';
import { StreamingContext } from '../../contexts/streaming-context.js';

// Mock child components or utilities if they are complex or have side effects
vi.mock('../indicators/agent-responding-spinner.js', () => ({
  AgentRespondingSpinner: ({
    nonRespondingDisplay,
  }: {
    nonRespondingDisplay?: string;
  }) => {
    const streamingState = React.useContext(StreamingContext)!;
    if (streamingState === StreamingState.Responding) {
      return <Text>MockRespondingSpinner</Text>;
    }
    return nonRespondingDisplay ? <Text>{nonRespondingDisplay}</Text> : null;
  },
}));

vi.mock('../markdown/markdown-display.js', () => ({
  MarkdownDisplay: function MockMarkdownDisplay({ text }: { text: string }) {
    return <Text>MockMarkdown:{text}</Text>;
  },
}));

describe('<ShellToolMessage />', () => {
  const baseProps: ShellToolMessageProps = {
    callId: 'tool-123',
    name: SHELL_COMMAND_NAME,
    description: 'A shell command',
    resultDisplay: { type: 'text', content: 'Test result' },
    status: ToolCallStatus.Executing,
    terminalWidth: 80,
    emphasis: 'medium',
    isFirst: true,
    borderColor: 'green',
    borderDimColor: false,
    config: {
      getEnableInteractiveShell: () => true,
    } as unknown as Config,
  };

  const mockSetEmbeddedShellFocused = vi.fn();
  const uiActions = {
    setEmbeddedShellFocused: mockSetEmbeddedShellFocused,
  };

  // Helper to render with context
  const renderWithContext = (
    ui: React.ReactElement,
    streamingState: StreamingState,
  ) =>
    renderWithProviders(ui, {
      uiActions,
      uiState: { streamingState },
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('interactive shell focus', () => {
    const shellProps: ShellToolMessageProps = {
      ...baseProps,
    };

    it('clicks inside the shell area sets focus to true', async () => {
      const { stdin, lastFrame, simulateClick } = renderWithProviders(
        <ShellToolMessage {...shellProps} />,
        {
          mouseEventsEnabled: true,
          uiActions,
        },
      );

      await waitFor(() => {
        expect(lastFrame()).toContain('A shell command'); // Wait for render
      });

      await simulateClick(stdin, 2, 2); // Click at column 2, row 2 (1-based)

      await waitFor(() => {
        expect(mockSetEmbeddedShellFocused).toHaveBeenCalledWith(true);
      });
    });

    it('handles focus for SHELL_TOOL_NAME (core shell tool)', async () => {
      const coreShellProps: ShellToolMessageProps = {
        ...shellProps,
        name: SHELL_TOOL_NAME,
      };

      const { stdin, lastFrame, simulateClick } = renderWithProviders(
        <ShellToolMessage {...coreShellProps} />,
        {
          mouseEventsEnabled: true,
          uiActions,
        },
      );

      await waitFor(() => {
        expect(lastFrame()).toContain('A shell command');
      });

      await simulateClick(stdin, 2, 2);

      await waitFor(() => {
        expect(mockSetEmbeddedShellFocused).toHaveBeenCalledWith(true);
      });
    });

    it('resets focus when shell finishes', async () => {
      let updateStatus: (s: ToolCallStatus) => void = () => {};

      const Wrapper = () => {
        const [status, setStatus] = React.useState(ToolCallStatus.Executing);
        updateStatus = setStatus;
        return (
          <ShellToolMessage
            {...shellProps}
            status={status}
            embeddedShellFocused={true}
            activeShellPtyId={1}
            ptyId={1}
          />
        );
      };

      const { lastFrame } = renderWithContext(<Wrapper />, StreamingState.Idle);

      // Verify it is initially focused
      await waitFor(() => {
        expect(lastFrame()).toContain('(Focused)');
      });

      // Now update status to Success
      await act(async () => {
        updateStatus(ToolCallStatus.Success);
      });

      // Should call setEmbeddedShellFocused(false) because isThisShellFocused became false
      await waitFor(() => {
        expect(mockSetEmbeddedShellFocused).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('command details', () => {
    const longCommand =
      'cd /workspace && grep -rni "health" node_modules packages apps --exclude-dir=dist --exclude-dir=coverage UNIQUE_COMMAND_TAIL';

    it('keeps short completed commands compact', () => {
      const { lastFrame } = renderWithContext(
        <ShellToolMessage
          {...baseProps}
          description="pnpm test"
          status={ToolCallStatus.Success}
        />,
        StreamingState.Idle,
      );

      expect(lastFrame()).toContain('pnpm test');
      expect(lastFrame()).not.toContain('…');
    });

    it('shows the full command when mouse interaction is unavailable', () => {
      const { lastFrame } = renderWithProviders(
        <ShellToolMessage
          {...baseProps}
          description={longCommand}
          status={ToolCallStatus.Success}
          terminalWidth={60}
        />,
        { mouseEventsEnabled: false },
      );

      expect(lastFrame()).toContain('UNIQUE_COMMAND_TAIL');
      expect(lastFrame()).not.toContain('⌄');
      expect(lastFrame()).not.toContain(' …');
    });

    it('expands and collapses a long completed command from its header', async () => {
      const { stdin, lastFrame, simulateClick } = renderWithProviders(
        <ShellToolMessage
          {...baseProps}
          description={longCommand}
          status={ToolCallStatus.Success}
          terminalWidth={60}
        />,
        {
          mouseEventsEnabled: true,
          uiActions,
        },
      );

      await waitFor(() => {
        expect(lastFrame()).toContain(' …');
        expect(lastFrame()).not.toContain(longCommand);
      });
      expect(lastFrame()).not.toContain('UNIQUE_COMMAND_TAIL');

      await simulateClick(stdin, 20, 2);

      await waitFor(() => {
        expect(lastFrame()).toContain('UNIQUE_COMMAND_TAIL');
        expect(lastFrame()).not.toContain(' …');
      });

      await simulateClick(stdin, 20, 2);

      await waitFor(() => {
        expect(lastFrame()).not.toContain(longCommand);
        expect(lastFrame()).toContain(' …');
        expect(lastFrame()).not.toContain('UNIQUE_COMMAND_TAIL');
      });
    });
  });
});
