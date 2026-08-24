/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  persistentStateMock,
  renderWithProviders,
} from '../../../test-utils/render.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ToolCallStatus } from '../../types.js';
import type { HistoryItem, HistoryItemWithoutId } from '../../types.js';
import { Text } from 'ink';

// Must import after test-utils/render.js
import { AlternateBufferQuittingDisplay } from './alternate-buffer-quitting-display.js';

vi.mock('../../hooks/terminal/terminal-setup.js', () => ({
  getTerminalProgram: () => null,
}));

vi.mock('../../contexts/app-context.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../contexts/app-context.js')>();
  return {
    ...actual,
    useAppContext: () => ({
      version: '0.10.0',
    }),
  };
});

vi.mock('../../../utils/header-loader.js', () => ({
  loadHeaderArt: vi.fn().mockReturnValue(null),
  loadCustomAsciiArt: vi.fn().mockReturnValue(undefined),
}));

vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
  return {
    ...actual,
    getMCPServerStatus: vi.fn(),
  };
});

vi.mock('./agent-responding-spinner.js', () => ({
  AgentRespondingSpinner: () => <Text>Spinner</Text>,
}));

const mockHistory: HistoryItem[] = [
  {
    id: 1,
    type: 'tool_group',
    tools: [
      {
        callId: 'call1',
        name: 'tool1',
        description: 'Description for tool 1',
        status: ToolCallStatus.Success,
        resultDisplay: undefined,
      },
    ],
  },
  {
    id: 2,
    type: 'tool_group',
    tools: [
      {
        callId: 'call2',
        name: 'tool2',
        description: 'Description for tool 2',
        status: ToolCallStatus.Success,
        resultDisplay: undefined,
      },
    ],
  },
];

const mockPendingHistoryItems: HistoryItemWithoutId[] = [
  {
    type: 'tool_group',
    tools: [
      {
        callId: 'call3',
        name: 'tool3',
        description: 'Description for tool 3',
        status: ToolCallStatus.Pending,
        resultDisplay: undefined,
      },
    ],
  },
];

describe('AlternateBufferQuittingDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const baseUIState = {
    terminalWidth: 80,
    mainAreaWidth: 80,
    slashCommands: [],
    activePtyId: undefined,
    embeddedShellFocused: false,
    renderMarkdown: false,
  };

  it('renders with active and pending tool messages', () => {
    persistentStateMock.setData({ tipsShown: 0 });
    const { lastFrame } = renderWithProviders(
      <AlternateBufferQuittingDisplay />,
      {
        uiState: {
          ...baseUIState,
          history: mockHistory,
          pendingHistoryItems: mockPendingHistoryItems,
        },
      },
    );
    expect(lastFrame()).toMatchSnapshot('with_history_and_pending');
  });

  it('renders with empty history and no pending items', () => {
    persistentStateMock.setData({ tipsShown: 0 });
    const { lastFrame } = renderWithProviders(
      <AlternateBufferQuittingDisplay />,
      {
        uiState: {
          ...baseUIState,
          history: [],
          pendingHistoryItems: [],
        },
      },
    );
    expect(lastFrame()).toMatchSnapshot('empty');
  });

  it('renders with history but no pending items', () => {
    persistentStateMock.setData({ tipsShown: 0 });
    const { lastFrame } = renderWithProviders(
      <AlternateBufferQuittingDisplay />,
      {
        uiState: {
          ...baseUIState,
          history: mockHistory,
          pendingHistoryItems: [],
        },
      },
    );
    expect(lastFrame()).toMatchSnapshot('with_history_no_pending');
  });

  it('renders with pending items but no history', () => {
    persistentStateMock.setData({ tipsShown: 0 });
    const { lastFrame } = renderWithProviders(
      <AlternateBufferQuittingDisplay />,
      {
        uiState: {
          ...baseUIState,
          history: [],
          pendingHistoryItems: mockPendingHistoryItems,
        },
      },
    );
    expect(lastFrame()).toMatchSnapshot('with_pending_no_history');
  });

  it('renders with user and agent messages', () => {
    persistentStateMock.setData({ tipsShown: 0 });
    const history: HistoryItem[] = [
      { id: 1, type: 'user', text: 'Hello Agent' },
      {
        id: 2,
        type: 'dsh_assistant',
        content: [{ type: 'text', text: 'Hello User!' }],
      },
    ];
    const { lastFrame } = renderWithProviders(
      <AlternateBufferQuittingDisplay />,
      {
        uiState: {
          ...baseUIState,
          history,
          pendingHistoryItems: [],
        },
      },
    );
    const output = lastFrame();
    expect(output).toContain('Hello Agent');
    expect(output).toContain('Hello User!');
  });
});
