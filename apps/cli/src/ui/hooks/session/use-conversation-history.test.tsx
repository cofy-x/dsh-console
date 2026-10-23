/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../../../test-utils/render.js';
import { waitFor } from '../../../test-utils/async.js';
import type {
  ConversationContentMessage,
  ConversationMessage,
  ConversationSnapshot,
} from '../../conversation-runtime.js';
import { MainContent } from '../../components/layout/main-content.js';
import {
  UIStateContext,
  type UIState,
} from '../../contexts/ui-state-context.js';
import type { HistoryItem } from '../../types.js';
import { useConversationHistory } from './use-conversation-history.js';
import { useHistory } from './use-history-manager.js';

vi.mock('../../contexts/app-context.js', () => ({
  useAppContext: () => ({ version: 'test' }),
}));
vi.mock('../terminal/use-alternate-buffer.js', () => ({
  useAlternateBuffer: () => false,
}));
vi.mock('../../components/layout/app-header.js', () => ({
  AppHeader: () => <Text>Header</Text>,
}));
vi.mock('../../components/shared/show-more-lines.js', () => ({
  ShowMoreLines: () => null,
}));
vi.mock('../../components/session/history-item-display.js', () => ({
  HistoryItemDisplay: ({
    item,
    isPending,
  }: {
    item: HistoryItem;
    isPending: boolean;
  }) => {
    const text =
      item.type === 'dsh_assistant' || item.type === 'dsh_user'
        ? item.content
            .flatMap((block) => (block.type === 'text' ? [block.text] : []))
            .join('')
        : item.type === 'tool_group'
          ? item.tools.map((tool) => `${tool.name}:${tool.status}`).join('')
          : '';
    const duration =
      item.type === 'dsh_assistant' ? item.turnMetrics?.durationMs : undefined;
    return (
      <Text>
        {text} [{isPending ? 'pending' : 'settled'}]
        {duration === undefined ? '' : ` ${String(duration)}ms`}
      </Text>
    );
  },
}));

function Harness({ snapshot }: { snapshot: ConversationSnapshot }) {
  const manager = useHistory();
  const pendingHistoryStart = useConversationHistory(
    'session-1',
    snapshot,
    manager,
  );
  const state: Partial<UIState> = {
    history: manager.history,
    pendingHistoryStart,
    pendingHistoryItems: [],
    mainAreaWidth: 80,
    staticAreaMaxItemHeight: 20,
    availableTerminalHeight: 24,
    slashCommands: [],
    constrainHeight: false,
    isEditorDialogOpen: false,
    activePtyId: undefined,
    embeddedShellFocused: false,
    historyRemountKey: 0,
  };
  return (
    <UIStateContext.Provider value={state as UIState}>
      <MainContent />
    </UIStateContext.Provider>
  );
}

function assistant(id: string, text: string): ConversationContentMessage {
  return { id, role: 'assistant', content: [{ type: 'text', text }] };
}

function snapshot(
  messages: ConversationMessage[],
  busy: boolean,
): ConversationSnapshot {
  return { messages, busy, todos: [] };
}

describe('conversation history rendering', () => {
  it('prints restored history once when StrictMode replays mount effects', async () => {
    const restored = snapshot([assistant('restored', 'Restored reply')], false);
    const view = render(
      <StrictMode>
        <Harness snapshot={restored} />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(view.lastFrame()).toContain('Restored reply [settled]'),
    );
    expect(view.lastFrame()?.match(/Restored reply/g)).toHaveLength(1);
  });

  it('updates streamed text and tools before committing the final Turn once', async () => {
    const prefix = assistant('old', 'Previous reply');
    const view = render(<Harness snapshot={snapshot([prefix], false)} />);
    await waitFor(() =>
      expect(view.lastFrame()).toContain('Previous reply [settled]'),
    );

    const tool: ConversationMessage = {
      id: 'tool-read',
      role: 'tool',
      callId: 'read',
      name: 'read',
      arguments: '{}',
      status: 'executing',
    };
    view.rerender(
      <Harness
        snapshot={snapshot([prefix, tool, assistant('new', 'L')], true)}
      />,
    );
    await waitFor(() => expect(view.lastFrame()).toContain('L [pending]'));
    expect(view.lastFrame()).toContain('read:Executing [pending]');

    view.rerender(
      <Harness
        snapshot={snapshot(
          [
            prefix,
            { ...tool, status: 'success' },
            assistant('new', 'LIVE_OK marker'),
          ],
          true,
        )}
      />,
    );
    await waitFor(() =>
      expect(view.lastFrame()).toContain('LIVE_OK marker [pending]'),
    );
    expect(view.lastFrame()).toContain('read:Success [pending]');
    expect(view.lastFrame()).not.toContain('read:Executing');
    expect(view.lastFrame()).not.toContain('L [pending]');

    const completed = snapshot(
      [
        prefix,
        { ...tool, status: 'success' },
        {
          ...assistant('new', 'LIVE_OK marker'),
          turnMetrics: { durationMs: 125 },
        },
      ],
      false,
    );
    view.rerender(<Harness snapshot={completed} />);
    await waitFor(() =>
      expect(view.lastFrame()).toContain('LIVE_OK marker [settled] 125ms'),
    );
    expect(view.lastFrame()).toContain('read:Success [settled]');
    expect(view.lastFrame()).not.toContain('[pending]');

    view.rerender(
      <Harness
        snapshot={snapshot(
          [...completed.messages, assistant('next', 'N')],
          true,
        )}
      />,
    );
    await waitFor(() => expect(view.lastFrame()).toContain('N [pending]'));
    expect(view.lastFrame()?.match(/Header/g)).toHaveLength(1);
    expect(view.lastFrame()?.match(/Previous reply/g)).toHaveLength(1);
    expect(view.lastFrame()?.match(/LIVE_OK marker/g)).toHaveLength(1);
  });

  it('removes an abandoned streamed draft before printing the settled history', async () => {
    const prefix = assistant('old', 'Previous reply');
    const view = render(
      <Harness
        snapshot={snapshot([prefix, assistant('draft', 'Failed draft')], true)}
      />,
    );
    await waitFor(() =>
      expect(view.lastFrame()).toContain('Failed draft [pending]'),
    );

    view.rerender(<Harness snapshot={snapshot([prefix], true)} />);
    await waitFor(() => expect(view.lastFrame()).not.toContain('Failed draft'));

    view.rerender(
      <Harness
        snapshot={snapshot(
          [prefix, assistant('replacement', 'Retried reply')],
          false,
        )}
      />,
    );
    await waitFor(() =>
      expect(view.lastFrame()).toContain('Retried reply [settled]'),
    );
    expect(view.lastFrame()).not.toContain('Failed draft');
    expect(view.lastFrame()?.match(/Previous reply/g)).toHaveLength(1);
  });
});
