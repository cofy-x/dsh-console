/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { ToolResultDisplay } from './tool-result-display.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Box, Text } from 'ink';
import type { ToolResultDisplay as ToolResultDisplayType } from '../../tool-result.js';
import type { AnsiOutput } from '@cofy-x/dsh-console-core';

// Mock child components to simplify testing
vi.mock('./diff-renderer.js', () => ({
  DiffRenderer: ({
    diffContent,
    filename,
  }: {
    diffContent: string;
    filename: string;
  }) => (
    <Box>
      <Text>
        DiffRenderer: {filename} - {diffContent}
      </Text>
    </Box>
  ),
}));

// Mock MarkdownDisplay
vi.mock('../markdown/markdown-display.js', () => ({
  MarkdownDisplay: function MockMarkdownDisplay({ text }: { text: string }) {
    return <Text>MarkdownDisplay: {text}</Text>;
  },
}));

// Mock AnsiOutputText
vi.mock('../shared/ansi-output.js', () => ({
  AnsiOutputText: function MockAnsiOutputText({
    data,
  }: {
    data: Array<Array<{ text: string; fg?: string; bg?: string }>>;
  }) {
    const serialized = JSON.stringify(data);
    return <Text>AnsiOutputText: {serialized}</Text>;
  },
}));

// Mock MaxSizedBox to avoid complex layout calculation
vi.mock('../shared/max-sized-box.js', () => ({
  MaxSizedBox: function MockMaxSizedBox({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <Box>{children}</Box>;
  },
}));

// Mock UIStateContext
const mockUseUIState = vi.fn();
vi.mock('../../contexts/ui-state-context.js', () => ({
  useUIState: () => mockUseUIState(),
}));

// Mock useAlternateBuffer
const mockUseAlternateBuffer = vi.fn();
vi.mock('../../hooks/terminal/use-alternate-buffer.js', () => ({
  useAlternateBuffer: () => mockUseAlternateBuffer(),
}));

// Mock useSettings
vi.mock('../../contexts/settings-context.js', () => ({
  useSettings: () => ({
    merged: {
      ui: {
        useAlternateBuffer: false,
      },
    },
  }),
}));

// Mock useOverflowActions
vi.mock('../../contexts/overflow-context.js', () => ({
  useOverflowActions: () => ({
    addOverflowingId: vi.fn(),
    removeOverflowingId: vi.fn(),
  }),
}));

describe('ToolResultDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUIState.mockReturnValue({ renderMarkdown: true });
    mockUseAlternateBuffer.mockReturnValue(false);
  });

  it('renders text result as markdown by default', () => {
    const textResult: ToolResultDisplayType = {
      type: 'text',
      content: '**Some result**',
    };
    const { lastFrame } = render(
      <ToolResultDisplay resultDisplay={textResult} terminalWidth={80} />,
    );
    const output = lastFrame();

    expect(output).toMatchSnapshot();
  });

  it('renders text result as plain text when renderOutputAsMarkdown is false', () => {
    const textResult: ToolResultDisplayType = {
      type: 'text',
      content: '**Some result**',
    };
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={textResult}
        terminalWidth={80}
        availableTerminalHeight={20}
        renderOutputAsMarkdown={false}
      />,
    );
    const output = lastFrame();

    expect(output).toMatchSnapshot();
  });

  it('truncates very long text results', { timeout: 20000 }, () => {
    const longString = 'a'.repeat(1000005);
    const textResult: ToolResultDisplayType = {
      type: 'text',
      content: longString,
    };
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={textResult}
        terminalWidth={80}
        availableTerminalHeight={20}
      />,
    );
    const output = lastFrame();

    expect(output).toMatchSnapshot();
  });

  it('renders diff result', () => {
    const diffResult: ToolResultDisplayType = {
      type: 'diff',
      content: {
        fileDiff: 'diff content',
        fileName: 'test.ts',
      },
    };
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={diffResult}
        terminalWidth={80}
        availableTerminalHeight={20}
      />,
    );
    const output = lastFrame();

    expect(output).toMatchSnapshot();
  });

  it('renders ANSI output result', () => {
    const ansiContent: AnsiOutput = [
      [
        {
          text: 'ansi content',
          fg: 'red',
          bg: 'black',
          bold: false,
          italic: false,
          underline: false,
          dim: false,
          inverse: false,
        },
      ],
    ];
    const ansiResult: ToolResultDisplayType = {
      type: 'ansi',
      content: ansiContent,
    };
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={ansiResult}
        terminalWidth={80}
        availableTerminalHeight={20}
      />,
    );
    const output = lastFrame();

    expect(output).toMatchSnapshot();
  });

  it('renders nothing for todo result', () => {
    const todoResult: ToolResultDisplayType = {
      type: 'todo',
      content: {
        todos: [],
      },
    };
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={todoResult}
        terminalWidth={80}
        availableTerminalHeight={20}
      />,
    );
    const output = lastFrame();

    expect(output).toMatchSnapshot();
  });

  it('auto-collapses long tool output without discarding its line count', () => {
    const textResult: ToolResultDisplayType = {
      type: 'text',
      content: Array.from(
        { length: 14 },
        (_, index) => `line ${String(index + 1)}`,
      ).join('\n'),
    };
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={textResult}
        terminalWidth={80}
        collapsed
        canToggle
      />,
    );

    const output = lastFrame();
    expect(output).toContain('14 lines | collapsed');
    expect(output).toContain('click to expand');
  });

  it('does not fall back to plain text if availableHeight is set and not in alternate buffer', () => {
    mockUseAlternateBuffer.mockReturnValue(false);
    const textResult: ToolResultDisplayType = {
      type: 'text',
      content: '**Some result**',
    };
    // availableHeight calculation: 20 - 1 - 5 = 14 > 3
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={textResult}
        terminalWidth={80}
        availableTerminalHeight={20}
        renderOutputAsMarkdown={true}
      />,
    );
    const output = lastFrame();
    expect(output).toMatchSnapshot();
  });

  it('keeps markdown if in alternate buffer even with availableHeight', () => {
    mockUseAlternateBuffer.mockReturnValue(true);
    const textResult: ToolResultDisplayType = {
      type: 'text',
      content: '**Some result**',
    };
    const { lastFrame } = render(
      <ToolResultDisplay
        resultDisplay={textResult}
        terminalWidth={80}
        availableTerminalHeight={20}
        renderOutputAsMarkdown={true}
      />,
    );
    const output = lastFrame();

    expect(output).toMatchSnapshot();
  });
});
