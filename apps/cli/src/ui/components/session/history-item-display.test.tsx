/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { HistoryItemDisplay } from './history-item-display.js';
import { type HistoryItem } from '../../types.js';
import { MessageType } from '../../types.js';
import { SessionStatsProvider } from '../../contexts/session-context.js';
import { renderWithProviders } from '../../../test-utils/render.js';
import type { Config } from '../../../config/config.js';
import { createInitialSessionMetrics } from '../../session-metrics.js';
import type { ConversationRuntime } from '../../conversation-runtime.js';

// Mock child components
vi.mock('../messages/tool-group-message.js', () => ({
  ToolGroupMessage: vi.fn(() => <div />),
}));

describe('<HistoryItemDisplay />', () => {
  const mockConfig = {} as unknown as Config;
  const conversationRuntime: ConversationRuntime = {
    getSnapshot: () => ({ messages: [], todos: [], busy: false }),
    getSessionStats: () => ({
      sessionId: 'test',
      metrics: createInitialSessionMetrics(),
      lastPromptTokenCount: 0,
    }),
    subscribe: () => () => {},
    submit: vi.fn(),
    cancel: vi.fn(),
    exit: vi.fn(),
  };
  const baseItem = {
    id: 1,
    timestamp: 12345,
    isPending: false,
    terminalWidth: 80,
    config: mockConfig,
  };

  it('renders UserMessage for "user" type', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: MessageType.USER,
      text: 'Hello',
    };
    const { lastFrame } = renderWithProviders(
      <HistoryItemDisplay {...baseItem} item={item} />,
    );
    expect(lastFrame()).toContain('Hello');
  });

  it('renders UserMessage for "user" type with slash command', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: MessageType.USER,
      text: '/theme',
    };
    const { lastFrame } = renderWithProviders(
      <HistoryItemDisplay {...baseItem} item={item} />,
    );
    expect(lastFrame()).toContain('/theme');
  });

  it('renders a DSH user image as a structured attachment card', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: 'dsh_user',
      content: [
        { type: 'text', text: 'Inspect this image:' },
        {
          type: 'image',
          attachment: {
            attachmentId: 'attachment-1',
            mediaType: 'image/png',
            bytes: 42,
            width: 10,
            height: 20,
            name: 'diagram.png',
          },
        },
      ],
    };
    const { lastFrame } = renderWithProviders(
      <HistoryItemDisplay {...baseItem} item={item} />,
    );
    const output = lastFrame();
    expect(output).toContain('>');
    expect(output).toContain('Inspect this image:');
    expect(output).toContain('diagram.png');
    expect(output).toContain('image/png');
    expect(output).toContain('10x20');
  });

  it.each([true, false])(
    'renders InfoMessage for "info" type with multi-line text (alternateBuffer=%s)',
    (useAlternateBuffer) => {
      const item: HistoryItem = {
        ...baseItem,
        type: MessageType.INFO,
        text: '⚡ Line 1\n⚡ Line 2\n⚡ Line 3',
      };
      const { lastFrame } = renderWithProviders(
        <HistoryItemDisplay {...baseItem} item={item} />,
        { useAlternateBuffer },
      );
      expect(lastFrame()).toMatchSnapshot();
    },
  );

  it('renders StatsDisplay for "stats" type', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: 'stats',
      duration: '1s',
    };
    const { lastFrame } = renderWithProviders(
      <SessionStatsProvider conversationRuntime={conversationRuntime}>
        <HistoryItemDisplay {...baseItem} item={item} />
      </SessionStatsProvider>,
    );
    expect(lastFrame()).toContain('Stats');
  });

  it('renders AboutBox for "about" type', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: 'about',
      cliVersion: '1.0.0',
      osVersion: 'test-os',
      modelVersion: 'test-model',
    };
    const { lastFrame } = renderWithProviders(
      <HistoryItemDisplay {...baseItem} item={item} />,
    );
    expect(lastFrame()).toContain('About DSH Console');
  });

  it('renders SessionSummaryDisplay for "quit" type', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: 'quit',
      duration: '1s',
    };
    const { lastFrame } = renderWithProviders(
      <SessionStatsProvider conversationRuntime={conversationRuntime}>
        <HistoryItemDisplay {...baseItem} item={item} />
      </SessionStatsProvider>,
    );
    expect(lastFrame()).toContain('Agent powering down. Goodbye!');
  });

  it('should escape ANSI codes in text content', () => {
    const historyItem: HistoryItem = {
      id: 1,
      type: 'user',
      text: 'Hello, \u001b[31mred\u001b[0m world!',
    };

    const { lastFrame } = renderWithProviders(
      <HistoryItemDisplay
        item={historyItem}
        terminalWidth={80}
        isPending={false}
      />,
    );

    // The ANSI codes should be escaped for display.
    expect(lastFrame()).toContain('Hello, \\u001b[31mred\\u001b[0m world!');
    // The raw ANSI codes should not be present.
    expect(lastFrame()).not.toContain('Hello, \u001b[31mred\u001b[0m world!');
  });

});
