/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { CommandRuntime } from '@deepseek-ai/dsh-commands';
import { describe, expect, it, vi } from 'vitest';
import { DshCommandRuntimeAdapter } from './command-runtime.js';

describe('DshCommandRuntimeAdapter', () => {
  it('projects descriptors and executes against the current Agent', async () => {
    const firstAgent = {} as Agent;
    let activeAgent = firstAgent;
    let notifyChange: (() => void) | undefined;
    const commands = {
      list: vi.fn(() => [
        {
          name: 'review',
          description: 'Review the current work',
          input: { hint: '<scope>', images: true },
        },
      ]),
      execute: vi.fn(async () => ({
        sourceEventSeq: 1,
        result: { kind: 'success' as const, text: 'queued' },
      })),
    } as unknown as Pick<CommandRuntime, 'list' | 'execute'>;
    const runtime = new DshCommandRuntimeAdapter(
      commands,
      () => activeAgent,
      (listener) => {
        notifyChange = listener;
        return vi.fn();
      },
    );

    expect(runtime.getSnapshot().commands).toEqual([
      {
        name: 'review',
        description: 'Review the current work',
        inputHint: '<scope>',
      },
    ]);

    const signal = new AbortController().signal;
    await expect(runtime.execute('/review src', signal)).resolves.toEqual({
      kind: 'success',
      text: 'queued',
    });
    expect(commands.execute).toHaveBeenCalledWith(
      firstAgent,
      '/review src',
      [],
      signal,
    );

    activeAgent = {} as Agent;
    runtime.activeAgentChanged();
    notifyChange?.();
    expect(commands.list).toHaveBeenLastCalledWith(activeAgent);
  });

  it('returns a safe error for an unknown command', async () => {
    const commands = {
      list: vi.fn(() => []),
      execute: vi.fn(async () => undefined),
    } as unknown as Pick<CommandRuntime, 'list' | 'execute'>;
    const runtime = new DshCommandRuntimeAdapter(
      commands,
      () => ({}) as Agent,
      () => vi.fn(),
    );

    await expect(
      runtime.execute('/missing', new AbortController().signal),
    ).resolves.toEqual({
      kind: 'error',
      text: 'Unknown DSH command: /missing',
    });
  });
});
