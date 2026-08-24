/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session';
import type { SessionQueryEngine, SessionRecord } from '@deepseek-ai/dsh-session-query';
import { DshSessionManagementRuntime } from './session-management-runtime.js';

const cwd = '/workspace/project';

function record(id: string, createdAt: number, persisted = true): SessionRecord {
  return {
    header: { version: 0, id: SessionId(id), createdAt, cwd },
    live: !persisted,
    persisted,
  };
}

function event(value: unknown): SessionEvent {
  return value as SessionEvent;
}

function harness(overrides: {
  records?: SessionRecord[];
  events?: SessionEvent[];
  eventsById?: Readonly<Record<string, SessionEvent[]>>;
  busy?: boolean;
} = {}) {
  const records = overrides.records ?? [];
  const query = {
    filterSessions: vi.fn(async () => records),
    readTitleSnapshots: vi.fn(async (ids: ReadonlyArray<ReturnType<typeof SessionId>>) =>
      ids.map((sessionId, index) => index === 0
        ? {
            sessionId,
            status: 'fulfilled' as const,
            value: {
              session: records.find((candidate) => candidate.header.id === sessionId)!.header,
              title: { title: 'First prompt', updatedAt: 1 },
            },
          }
        : { sessionId, status: 'rejected' as const, reason: new Error('missing title') })),
    listEvents: vi.fn(async (sessionId: ReturnType<typeof SessionId>) =>
      (overrides.eventsById?.[String(sessionId)] ?? overrides.events ?? []).map((item) => ({
        sessionId,
        seq: item.seq,
        type: item.type,
        time: item.time,
        surface: 'log-only' as const,
      }))),
    readSession: vi.fn(async (sessionId: ReturnType<typeof SessionId>) => ({
      session: records.find((candidate) => candidate.header.id === sessionId)!.header,
      events: overrides.eventsById?.[String(sessionId)] ?? overrides.events ?? [],
    })),
  } as unknown as SessionQueryEngine;
  const resolved = {
    provider: 'deepseek',
    id: 'vision-model',
    name: 'Vision Model',
    inputModalities: ['text', 'image'] as const,
  };
  const llm = {
    resolveModelInfo: vi.fn(async () => resolved),
  } as unknown as LlmRuntime;
  let next = 0;
  const callbacks = {
    currentSelection: vi.fn(() => ({
      provider: 'deepseek',
      model: 'text-model',
      name: 'Text Model',
      inputModalities: ['text'] as const,
    })),
    createFresh: vi.fn(async (_selection: ModelSelection) => `dsh-console-new-${++next}`),
    resume: vi.fn(async (sessionId: ReturnType<typeof SessionId>) => String(sessionId)),
    adoptCurrentModel: vi.fn(),
    hasConversation: vi.fn(() => true),
    isBusy: vi.fn(() => overrides.busy ?? false),
  };
  const runtime = new DshSessionManagementRuntime(
    query,
    llm,
    cwd,
    'dsh-console-current',
    callbacks,
  );
  return { runtime, query, llm, callbacks };
}

describe('DshSessionManagementRuntime', () => {
  it('lists only top-level workspace Console Sessions and tolerates missing titles', async () => {
    const records = [
      record('dsh-console-current', 4, false),
      record('dsh-console-history', 3),
      record('dsh-console-completion-hidden', 2),
      record('another-client-session', 1),
    ];
    const requestHeader = event({
      type: 'request/header',
      data: { reason: 'initial', header: { config: { provider: 'deepseek', model: 'text-model' } } },
    });
    const { runtime, query } = harness({ records, events: [requestHeader] });

    await expect(runtime.listSessions()).resolves.toEqual([
      {
        id: 'dsh-console-current',
        title: 'First prompt',
        createdAt: 4,
        current: true,
        persisted: false,
        resumable: false,
      },
      {
        id: 'dsh-console-history',
        createdAt: 3,
        current: false,
        persisted: true,
        resumable: true,
      },
    ]);
    expect(query.filterSessions).toHaveBeenCalledWith([
      { kind: 'cwd', values: [cwd] },
      { kind: 'parent', values: [null] },
    ], undefined);
  });

  it('hides empty history and marks legacy conversations without a route as unavailable', async () => {
    const empty = record('dsh-console-empty', 2);
    const legacy = record('dsh-console-legacy', 1);
    const { runtime } = harness({
      records: [empty, legacy],
      eventsById: {
        'dsh-console-empty': [],
        'dsh-console-legacy': [event({
          type: 'user/message',
          data: {
            id: 'legacy-user',
            role: 'user',
            source: { kind: 'user' },
            content: [{ type: 'text', text: 'hello' }],
          },
        })],
      },
    });

    await expect(runtime.listSessions()).resolves.toEqual([{
      id: 'dsh-console-legacy',
      title: 'First prompt',
      createdAt: 1,
      current: false,
      persisted: true,
      resumable: false,
      resumeUnavailableReason: 'Missing model route.',
    }]);
  });

  it('creates a fresh Session with the current model and publishes its identity once', async () => {
    const { runtime, callbacks } = harness();
    const listener = vi.fn();
    runtime.subscribe(listener);

    await runtime.createNew();

    expect(callbacks.createFresh).toHaveBeenCalledWith(
      { provider: 'deepseek', model: 'text-model' },
      undefined,
    );
    expect(runtime.getSnapshot().currentSessionId).toBe('dsh-console-new-1');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resumes with the last request route and adopts only the current model', async () => {
    const target = record('dsh-console-history', 3);
    const events = [event({
      seq: 0,
      time: 1,
      type: 'request/header',
      data: {
        reason: 'initial',
        header: { config: { provider: 'deepseek', model: 'vision-model' } },
      },
    })];
    const { runtime, callbacks, llm } = harness({ records: [target], events });

    await runtime.resumeSession('dsh-console-history');

    expect(llm.resolveModelInfo).toHaveBeenCalledWith('deepseek', 'vision-model', undefined);
    expect(callbacks.resume).toHaveBeenCalledWith(
      SessionId('dsh-console-history'),
      { provider: 'deepseek', model: 'vision-model' },
      undefined,
    );
    expect(callbacks.adoptCurrentModel).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'deepseek',
      model: 'vision-model',
    }));
    expect(runtime.getSnapshot().currentSessionId).toBe('dsh-console-history');
  });

  it('keeps the current Session when model resolution fails', async () => {
    const target = record('dsh-console-history', 3);
    const events = [event({
      type: 'request/header',
      data: { reason: 'initial', header: { config: { provider: 'gone', model: 'gone' } } },
    })];
    const { runtime, callbacks, llm } = harness({ records: [target], events });
    vi.mocked(llm.resolveModelInfo).mockRejectedValue(new Error('model unavailable'));

    await expect(runtime.resumeSession('dsh-console-history')).rejects.toThrow('model unavailable');
    expect(callbacks.resume).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().currentSessionId).toBe('dsh-console-current');
  });

  it('rejects switching while the current Agent is working', async () => {
    const { runtime, callbacks } = harness({ busy: true });
    await expect(runtime.createNew()).rejects.toThrow('current Agent is working');
    expect(callbacks.createFresh).not.toHaveBeenCalled();
  });

  it('serializes Session changes across concurrent callers', async () => {
    const { runtime, callbacks } = harness();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    callbacks.createFresh.mockImplementation(async () => {
      await pending;
      return 'dsh-console-new';
    });

    const first = runtime.createNew();
    await vi.waitFor(() => expect(callbacks.createFresh).toHaveBeenCalledOnce());
    expect(runtime.isBusy()).toBe(true);
    await expect(runtime.createNew()).rejects.toThrow('already in progress');
    finish();
    await first;
    expect(runtime.isBusy()).toBe(false);
  });

  it('treats the current Session as a no-op even while its Agent is working', async () => {
    const { runtime, callbacks } = harness({ busy: true });
    await expect(runtime.resumeSession('dsh-console-current')).resolves.toBeUndefined();
    expect(callbacks.resume).not.toHaveBeenCalled();
  });
});
