/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
import {
  SessionId,
  SessionSeq,
  type SessionEvent,
  type SessionHeader,
} from '@deepseek-ai/dsh-session';
import type {
  SessionEventSearchDocument,
  SessionQueryEngine,
} from '@deepseek-ai/dsh-session-query';
import type { SessionManagementRuntime } from '../ui/session-management-runtime.js';
import { DshSessionExplorerRuntime } from './session-explorer-runtime.js';
import { isConsoleSessionHeader } from './session-identity.js';

const cwd = '/workspace/project';
function header(id = 'dsh-console-history', extra = {}): SessionHeader {
  return {
    id: SessionId(id),
    cwd,
    createdAt: 1,
    ...extra,
  } as unknown as SessionHeader;
}

function harness(
  options: { blankKnown?: boolean; blank?: boolean; title?: string } = {},
) {
  const session = header();
  const events = [
    {
      seq: 0,
      time: 1,
      type: 'request/header',
      data: {
        reason: 'initial',
        header: { config: { provider: 'deepseek', model: 'alpha' } },
      },
    },
    {
      seq: 1,
      time: 2,
      type: 'turn/end',
      data: { turn: 0, reason: { kind: 'completed' } },
    },
    {
      seq: 2,
      time: 3,
      type: 'request/header',
      data: {
        reason: 'initial',
        header: { config: { provider: 'deepseek', model: 'beta' } },
      },
    },
  ] as unknown as SessionEvent[];
  const query = {
    readSession: vi.fn(async () => ({ session, events })),
    readTitleSnapshots: vi.fn(async () => [
      {
        sessionId: session.id,
        status: 'fulfilled',
        value: { session, title: { title: 'Pinned title' } },
      },
    ]),
    filterEvents: vi.fn(
      async () =>
        [
          {
            sessionId: session.id,
            seq: SessionSeq(1),
            type: 'user/message',
            time: 1,
            surface: 'current',
            text: 'Existing conversation',
          },
        ] as SessionEventSearchDocument[],
    ),
  };
  const management = {
    getSnapshot: () => ({ currentSessionId: 'dsh-console-current' }),
    isBusy: vi.fn(() => false),
  };
  const llm = {
    resolveModelInfo: vi.fn(async (_provider, model) => ({
      provider: 'deepseek',
      id: model,
      name: model,
      inputModalities: ['text'],
    })),
  };
  const callbacks = {
    list: vi.fn(async () => [
      {
        id: String(session.id),
        cwd,
        updatedAt: 10,
        running: false,
        blank: options.blank ?? false,
        blankKnown: options.blankKnown ?? true,
        persisted: true,
        title: options.title ?? 'Pinned title',
      },
    ]),
    search: vi.fn(async () => ({
      items: [{ id: String(session.id), snippet: 'Matching conversation' }],
      hasMore: false,
    })),
    rename: vi.fn(async (_id, title) => title.trim()),
    fork: vi.fn(async () => {}),
    adoptCurrentModel: vi.fn(),
  };
  const runtime = new DshSessionExplorerRuntime(
    query as unknown as SessionQueryEngine,
    llm as unknown as LlmRuntime,
    cwd,
    management as unknown as SessionManagementRuntime,
    { presentCall: () => undefined, presentResult: () => undefined },
    callbacks,
  );
  return { runtime, query, management, llm, callbacks, session, events };
}

describe('Console Session identity', () => {
  it('admits durable Console forks while excluding internal and delegated children', () => {
    expect(isConsoleSessionHeader(header())).toBe(true);
    expect(
      isConsoleSessionHeader(
        header('dsh-console-fork-1', {
          parentSession: SessionId('dsh-console-parent'),
        }),
      ),
    ).toBe(true);
    for (const id of [
      'dsh-console-side-1',
      'dsh-console-completion-1',
      'dsh-console-history\nspoofed',
      'dsh-console-history\u202espoofed',
      'foreign',
    ])
      expect(isConsoleSessionHeader(header(id))).toBe(false);
    expect(
      isConsoleSessionHeader(
        header('dsh-console-child', {
          parentSession: SessionId('dsh-console-parent'),
        }),
      ),
    ).toBe(false);
    expect(
      isConsoleSessionHeader(
        header('dsh-console-fork-1', { origin: 'subagent' }),
      ),
    ).toBe(false);
  });
});

describe('DshSessionExplorerRuntime', () => {
  it('renders a projection-backed catalog without reading Session logs', async () => {
    const h = harness();
    await expect(h.runtime.search('')).resolves.toMatchObject({
      items: [{ id: 'dsh-console-history', title: 'Pinned title' }],
    });
    expect(h.callbacks.list).toHaveBeenCalledOnce();
    expect(h.query.filterEvents).not.toHaveBeenCalled();
  });

  it('uses the DSH search endpoint for conversation text', async () => {
    const h = harness();
    await expect(h.runtime.search('matching')).resolves.toMatchObject({
      items: [
        {
          id: 'dsh-console-history',
          snippet: 'Matching conversation',
        },
      ],
    });
    expect(h.callbacks.search).toHaveBeenCalledWith(
      'matching',
      [h.session.id],
      expect.any(AbortSignal),
    );
  });

  it('keeps title matches while DSH supplements a partial result page', async () => {
    const h = harness();
    await expect(h.runtime.search('pinned')).resolves.toMatchObject({
      items: [{ id: 'dsh-console-history' }],
    });
    expect(h.callbacks.search).toHaveBeenCalledOnce();
  });

  it('searches unresolved Sessions directly without waiting for hydration', async () => {
    const h = harness({ blankKnown: false, title: '' });
    await expect(h.runtime.search('matching')).resolves.toMatchObject({
      items: [{ id: 'dsh-console-history', snippet: 'Matching conversation' }],
    });
    expect(h.callbacks.search).toHaveBeenCalledWith(
      'matching',
      [h.session.id],
      expect.any(AbortSignal),
    );
    expect(h.query.filterEvents).not.toHaveBeenCalled();
  });

  it('hides projection-confirmed blank Sessions', async () => {
    const h = harness({ blank: true });
    await expect(h.runtime.search('')).resolves.toMatchObject({ items: [] });
    expect(h.query.filterEvents).not.toHaveBeenCalled();
  });

  it('shows unresolved Sessions immediately without scanning their logs', async () => {
    const h = harness({ blankKnown: false, title: '' });
    await expect(h.runtime.search('')).resolves.toMatchObject({
      items: [{ id: 'dsh-console-history' }],
    });
    expect(h.query.filterEvents).not.toHaveBeenCalled();
  });

  it('reuses catalog summaries and invalidates changed Sessions', async () => {
    const h = harness();
    await h.runtime.search('');
    await h.runtime.search('pinned');
    expect(h.callbacks.list).toHaveBeenCalledOnce();
    h.runtime.invalidateSession('dsh-console-history');
    await h.runtime.search('');
    expect(h.callbacks.list).toHaveBeenCalledTimes(2);
  });

  it('does not scan Session logs when DSH conversation search fails', async () => {
    const h = harness();
    h.callbacks.search.mockRejectedValueOnce(new Error('index unavailable'));
    await expect(h.runtime.search('hello')).resolves.toMatchObject({
      items: [],
      notice: expect.stringContaining('Conversation search is unavailable'),
    });
    expect(h.query.filterEvents).not.toHaveBeenCalled();
  });

  it('rejects cancellation before loading the catalog', async () => {
    const h = harness();
    const controller = new AbortController();
    controller.abort();
    await expect(h.runtime.search('x', controller.signal)).rejects.toThrow();
    expect(h.callbacks.list).not.toHaveBeenCalled();
  });

  it('renames through the canonical write callback and updates the catalog', async () => {
    const h = harness();
    await h.runtime.search('');
    await expect(
      h.runtime.rename('dsh-console-history', ' New title '),
    ).resolves.toBe('New title');
    await expect(h.runtime.search('New title')).resolves.toMatchObject({
      items: [{ id: 'dsh-console-history', title: 'New title' }],
    });
  });

  it('rejects blank titles and foreign workspace writes', async () => {
    const h = harness();
    await expect(h.runtime.rename('dsh-console-history', '  ')).rejects.toThrow(
      'empty',
    );
    h.query.readSession.mockResolvedValueOnce({
      session: header('dsh-console-history', { cwd: '/elsewhere' }),
      events: h.events,
    });
    await expect(
      h.runtime.rename('dsh-console-history', 'Title'),
    ).rejects.toThrow('another workspace');
    expect(h.callbacks.rename).not.toHaveBeenCalled();
  });

  it('forks only through a completed Turn and restores the route at that cut', async () => {
    const h = harness();
    await h.runtime.search('');
    await h.runtime.fork('dsh-console-history', 1);
    expect(h.llm.resolveModelInfo).toHaveBeenCalledWith(
      'deepseek',
      'alpha',
      undefined,
    );
    expect(h.callbacks.fork).toHaveBeenCalledWith(
      'dsh-console-history',
      h.events.slice(0, 2),
      { provider: 'deepseek', model: 'alpha' },
      undefined,
    );
    expect(h.callbacks.adoptCurrentModel).toHaveBeenCalledOnce();
    await h.runtime.search('');
    expect(h.callbacks.list).toHaveBeenCalledTimes(2);
  });

  it('rejects incomplete boundaries and preserves model selection on fork failure', async () => {
    const h = harness();
    await expect(h.runtime.fork('dsh-console-history', 2)).rejects.toThrow(
      'completed Turn',
    );
    h.callbacks.fork.mockRejectedValueOnce(new Error('disk full'));
    await expect(h.runtime.fork('dsh-console-history', 1)).rejects.toThrow(
      'disk full',
    );
    expect(h.callbacks.adoptCurrentModel).not.toHaveBeenCalled();
  });

  it('rejects writes while the current Agent is busy', async () => {
    const h = harness();
    h.management.isBusy.mockReturnValue(true);
    await expect(
      h.runtime.rename('dsh-console-history', 'Title'),
    ).rejects.toThrow('Wait');
    await expect(h.runtime.fork('dsh-console-history', 1)).rejects.toThrow(
      'Wait',
    );
    expect(h.query.readSession).not.toHaveBeenCalled();
  });
});
