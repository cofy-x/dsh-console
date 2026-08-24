/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  renderWithProviders,
} from '../../../test-utils/render.js';
import { describe, it, expect } from 'vitest';
import { ToolGroupMessage } from './tool-group-message.js';
import type { IndividualToolCallDisplay } from '../../types.js';
import { ToolCallStatus } from '../../types.js';
import type { Config } from '../../../config/config.js';

describe('<ToolGroupMessage />', () => {
  const createToolCall = (
    overrides: Partial<IndividualToolCallDisplay> = {},
  ): IndividualToolCallDisplay => ({
    callId: 'tool-123',
    name: 'test-tool',
    description: 'A tool for testing',
    resultDisplay: {
      type: 'text',
      content: 'Test result',
    },
    status: ToolCallStatus.Success,
    renderOutputAsMarkdown: false,
    ...overrides,
  });

  const baseProps = {
    groupId: 1,
    terminalWidth: 80,
    isFocused: true,
  };

  const baseMockConfig = {
    getModel: () => 'deepseek/deepseek-chat',
    getTargetDir: () => '/test',
    getDebugMode: () => false,
    getEnableInteractiveShell: () => true,
  } as unknown as Config;

  describe('Golden Snapshots', () => {
    it('renders single successful tool call', () => {
      const toolCalls = [createToolCall()];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={toolCalls} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders multiple tool calls with different statuses', () => {
      const toolCalls = [
        createToolCall({
          callId: 'tool-1',
          name: 'successful-tool',
          description: 'This tool succeeded',
          status: ToolCallStatus.Success,
        }),
        createToolCall({
          callId: 'tool-2',
          name: 'pending-tool',
          description: 'This tool is pending',
          status: ToolCallStatus.Pending,
        }),
        createToolCall({
          callId: 'tool-3',
          name: 'error-tool',
          description: 'This tool failed',
          status: ToolCallStatus.Error,
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={toolCalls} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders shell command with yellow border', () => {
      const toolCalls = [
        createToolCall({
          callId: 'shell-1',
          name: 'run_shell_command',
          description: 'Execute shell command',
          status: ToolCallStatus.Success,
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={toolCalls} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders mixed tool calls including shell command', () => {
      const toolCalls = [
        createToolCall({
          callId: 'tool-1',
          name: 'read_file',
          description: 'Read a file',
          status: ToolCallStatus.Success,
        }),
        createToolCall({
          callId: 'tool-2',
          name: 'run_shell_command',
          description: 'Run command',
          status: ToolCallStatus.Executing,
        }),
        createToolCall({
          callId: 'tool-3',
          name: 'write_file',
          description: 'Write to file',
          status: ToolCallStatus.Pending,
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={toolCalls} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders with limited terminal height', () => {
      const toolCalls = [
        createToolCall({
          callId: 'tool-1',
          name: 'tool-with-result',
          description: 'Tool with output',
          resultDisplay: {
            type: 'text',
            content: 'This is a long result that might need height constraints',
          },
        }),
        createToolCall({
          callId: 'tool-2',
          name: 'another-tool',
          description: 'Another tool',
          resultDisplay: {
            type: 'text',
            content: 'More output here',
          },
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage
          {...baseProps}
          toolCalls={toolCalls}
          availableTerminalHeight={10}
        />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders when not focused', () => {
      const toolCalls = [createToolCall()];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage
          {...baseProps}
          toolCalls={toolCalls}
          isFocused={false}
        />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders with narrow terminal width', () => {
      const toolCalls = [
        createToolCall({
          name: 'very-long-tool-name-that-might-wrap',
          description:
            'This is a very long description that might cause wrapping issues',
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage
          {...baseProps}
          toolCalls={toolCalls}
          terminalWidth={40}
        />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders empty tool calls array', () => {
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={[]} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: [] }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('renders tool call with outputFile', () => {
      const toolCalls = [
        createToolCall({
          callId: 'tool-output-file',
          name: 'tool-with-file',
          description: 'Tool that saved output to file',
          status: ToolCallStatus.Success,
          outputFile: '/path/to/output.txt',
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={toolCalls} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

  });

  describe('Border Color Logic', () => {
    it('uses yellow border for shell commands even when successful', () => {
      const toolCalls = [
        createToolCall({
          name: 'run_shell_command',
          status: ToolCallStatus.Success,
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={toolCalls} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });

    it('uses gray border when all tools are successful and no shell commands', () => {
      const toolCalls = [
        createToolCall({ status: ToolCallStatus.Success }),
        createToolCall({
          callId: 'tool-2',
          name: 'another-tool',
          status: ToolCallStatus.Success,
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage {...baseProps} toolCalls={toolCalls} />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });
  });

  describe('Height Calculation', () => {
    it('calculates available height correctly with multiple tools with results', () => {
      const toolCalls = [
        createToolCall({
          callId: 'tool-1',
          resultDisplay: {
            type: 'text',
            content: 'Result 1',
          },
        }),
        createToolCall({
          callId: 'tool-2',
          resultDisplay: {
            type: 'text',
            content: 'Result 2',
          },
        }),
        createToolCall({
          callId: 'tool-3',
          resultDisplay: {
            type: 'text',
            content: '',
          },
        }),
      ];
      const { lastFrame, unmount } = renderWithProviders(
        <ToolGroupMessage
          {...baseProps}
          toolCalls={toolCalls}
          availableTerminalHeight={20}
        />,
        {
          config: baseMockConfig,
          uiState: {
            pendingHistoryItems: [{ type: 'tool_group', tools: toolCalls }],
          },
        },
      );
      expect(lastFrame()).toMatchSnapshot();
      unmount();
    });
  });

});
