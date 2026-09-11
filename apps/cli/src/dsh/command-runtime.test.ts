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
          input: { hint: '<scope>', attachments: true },
        },
      ]),
      execute: vi.fn(async () => ({
        result: {
          kind: 'success' as const,
          text: 'queued',
          sourceEventSeq: 1,
        },
      })),
    } as unknown as Pick<CommandRuntime, 'list' | 'execute'>;
    const runtime = new DshCommandRuntimeAdapter(
      commands,
      () => activeAgent,
      (listener) => {
        notifyChange = listener;
        return vi.fn();
      },
      vi.fn(async () => activeAgent),
    );

    expect(runtime.getSnapshot().commands).toEqual([
      {
        name: 'review',
        description: 'Review the current work',
        inputHint: '<scope>',
        acceptsAttachments: true,
      },
    ]);

    const signal = new AbortController().signal;
    await expect(
      runtime.execute(
        '/review src',
        [
          {
            sourceKind: 'workspace-file',
            path: import.meta.filename,
            mediaType: 'image/png',
            name: 'review.png',
          },
        ],
        signal,
      ),
    ).resolves.toEqual({
      kind: 'success',
      text: 'queued',
      sourceEventSeq: 1,
    });
    expect(commands.execute).toHaveBeenCalledWith(
      firstAgent,
      '/review src',
      [
        expect.objectContaining({
          type: 'image',
          mediaType: 'image/png',
          name: 'review.png',
        }),
      ],
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
      vi.fn(async () => ({}) as Agent),
    );

    await expect(
      runtime.execute('/missing', [], new AbortController().signal),
    ).resolves.toEqual({
      kind: 'error',
      text: 'Unknown DSH command: /missing',
    });
  });

  it('materializes the main Agent before exposing commands', async () => {
    let activeAgent: Agent | undefined;
    const list = vi.fn(() => [
      {
        name: 'plan',
        description: 'Enter plan mode',
        acceptsAttachments: false,
      },
    ]);
    const execute = vi.fn(async () => undefined);
    const ensureActiveAgent = vi.fn(async () => {
      activeAgent = {} as Agent;
      return activeAgent;
    });
    const runtime = new DshCommandRuntimeAdapter(
      { list, execute },
      () => activeAgent,
      () => vi.fn(),
      ensureActiveAgent,
    );

    expect(runtime.getSnapshot()).toEqual({ commands: [] });
    await runtime.prepare(new AbortController().signal);
    expect(runtime.getSnapshot().commands).toEqual([
      {
        name: 'plan',
        description: 'Enter plan mode',
        acceptsAttachments: false,
      },
    ]);
    await runtime.prepare(new AbortController().signal);
    expect(ensureActiveAgent).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith(activeAgent);
  });
});
