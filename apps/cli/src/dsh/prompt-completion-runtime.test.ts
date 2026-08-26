/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  CreateAgentOptions,
  ModelSelection,
} from '@deepseek-ai/dsh-agent';
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import {
  DshPromptCompletionRuntime,
  type DshPromptCompletionServices,
} from './prompt-completion-runtime.js';

type Emit = (event: SessionEvent) => void;

interface FakeTurn {
  cancel: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  emit: Emit;
  finish(): void;
}

function event(value: unknown): SessionEvent {
  return value as SessionEvent;
}

function createHarness(
  drive: (turn: FakeTurn, index: number) => void,
  selection: ModelSelection = {
    provider: 'fake',
    model: 'fake-model',
  },
): {
  runtime: DshPromptCompletionRuntime;
  createAgent: ReturnType<typeof vi.fn>;
  turns: FakeTurn[];
} {
  const listeners = new Set<
    (session: Session, event: SessionEvent) => void
  >();
  const turns: FakeTurn[] = [];
  const createAgent = vi.fn(async (options: CreateAgentOptions) => {
    const session = { id: options.sessionId } as Session;
    let resolveIdle = () => {};
    const idle = new Promise<void>((resolve) => {
      resolveIdle = resolve;
    });
    const emit: Emit = (sessionEvent) => {
      for (const listener of listeners) listener(session, sessionEvent);
    };
    const cancel = vi.fn(() => resolveIdle());
    const dispose = vi.fn(async () => {});
    const turn: FakeTurn = {
      cancel,
      dispose,
      emit,
      finish: resolveIdle,
    };
    turns.push(turn);
    const agent = {
      session,
      cancel,
      followup: vi.fn(() => drive(turn, turns.length - 1)),
      whenIdle: vi.fn(() => idle),
    } as unknown as Agent;
    return { agent, dispose };
  });
  const services: DshPromptCompletionServices = {
    createAgent,
    onSessionEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    runtime: new DshPromptCompletionRuntime(services, selection),
    createAgent,
    turns,
  };
}

function completeTurn(turn: FakeTurn, text: string): void {
  turn.emit(
    event({
      type: 'assistant/chunk',
      data: {
        turn: 1,
        step: 1,
        chunk: { type: 'text-delta', index: 0, text },
      },
    }),
  );
  turn.emit(
    event({
      type: 'turn/end',
      data: { turn: 1, reason: { kind: 'completed' } },
    }),
  );
  turn.finish();
}

describe('DshPromptCompletionRuntime', () => {
  it('uses an isolated temporary agent and disposes it after completion', async () => {
    const harness = createHarness((turn) => completeTurn(turn, 'hello world'));

    await expect(
      harness.runtime.complete('hello', new AbortController().signal),
    ).resolves.toBe('hello world');

    const options = harness.createAgent.mock.calls[0][0] as CreateAgentOptions;
    expect(String(options.sessionId)).toMatch(/^dsh-console-completion-/);
    expect(harness.turns[0].dispose).toHaveBeenCalledOnce();
  });

  it('uses the active reasoning effort for the isolated agent', async () => {
    const reasoningEffort = ReasoningEffortId('high');
    const harness = createHarness(
      (turn) => completeTurn(turn, 'hello world'),
      { provider: 'fake', model: 'fake-model', reasoningEffort },
    );

    await harness.runtime.complete('hello', new AbortController().signal);

    const options = harness.createAgent.mock.calls[0][0] as CreateAgentOptions;
    expect(options.agentOptions).toEqual({
      provider: 'fake',
      model: 'fake-model',
      reasoningEffort,
    });
  });

  it('cancels the active completion turn through AbortSignal', async () => {
    const harness = createHarness(() => {});
    const controller = new AbortController();
    const completion = harness.runtime.complete('hello', controller.signal);
    await vi.waitFor(() => expect(harness.turns).toHaveLength(1));

    controller.abort();

    await expect(completion).resolves.toBeNull();
    expect(harness.turns[0].cancel).toHaveBeenCalledWith({ kind: 'user' });
  });

  it('discards a stale completion when a newer request starts', async () => {
    const harness = createHarness((turn, index) => {
      if (index === 1) completeTurn(turn, 'hello again');
    });
    const first = harness.runtime.complete(
      'old',
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(harness.turns).toHaveLength(1));

    const second = harness.runtime.complete(
      'hello',
      new AbortController().signal,
    );

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBe('hello again');
    expect(harness.turns[0].cancel).toHaveBeenCalledOnce();
  });

  it('rejects a completion that does not preserve the original prefix', async () => {
    const harness = createHarness((turn) => completeTurn(turn, 'different'));

    await expect(
      harness.runtime.complete('hello', new AbortController().signal),
    ).resolves.toBeNull();
  });

  it('cancels active work when disposed', async () => {
    const harness = createHarness(() => {});
    const completion = harness.runtime.complete(
      'hello',
      new AbortController().signal,
    );
    await vi.waitFor(() => expect(harness.turns).toHaveLength(1));

    await harness.runtime.dispose();

    await expect(completion).resolves.toBeNull();
    expect(harness.turns[0].cancel).toHaveBeenCalledOnce();
  });
});
