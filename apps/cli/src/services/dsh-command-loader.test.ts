/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { DshCommandRuntime } from '../ui/command-runtime.js';
import { CommandKind } from '../ui/commands/types.js';
import { DshCommandLoader } from './dsh-command-loader.js';

describe('DshCommandLoader', () => {
  it('keeps commands with input in the composer and executes no-input commands', async () => {
    const runtime: DshCommandRuntime = {
      getSnapshot: () => ({
        commands: [
          {
            name: 'review',
            description: 'Review a scope',
            inputHint: '<scope>',
            acceptsAttachments: true,
          },
          {
            name: 'status',
            description: 'Show status',
            acceptsAttachments: false,
          },
        ],
      }),
      subscribe: () => vi.fn(),
      prepare: vi.fn(async () => undefined),
      attachmentPolicy: vi.fn(),
      execute: vi.fn(),
    };

    const commands = await new DshCommandLoader(runtime).loadCommands(
      new AbortController().signal,
    );

    expect(commands).toMatchObject([
      {
        name: 'review',
        inputHint: '<scope>',
        autoExecute: false,
        kind: CommandKind.DSH,
      },
      {
        name: 'status',
        autoExecute: true,
        kind: CommandKind.DSH,
      },
    ]);
  });

  it('renders result text even when a domain event owns richer presentation', async () => {
    const signal = new AbortController().signal;
    const runtime: DshCommandRuntime = {
      getSnapshot: () => ({
        commands: [
          {
            name: 'compact',
            description: 'Compact history',
            acceptsAttachments: false,
          },
        ],
      }),
      subscribe: () => vi.fn(),
      prepare: vi.fn(async () => undefined),
      execute: vi.fn(async () => ({
        kind: 'success' as const,
        text: 'Compacted 12 history items.',
        sourceEventSeq: 42,
      })),
    };
    const [command] = await new DshCommandLoader(runtime).loadCommands(signal);

    await expect(
      command?.action?.(
        {
          invocation: {
            raw: '/compact',
            name: 'compact',
            args: '',
            signal,
            attachments: [],
          },
        } as never,
        '',
      ),
    ).resolves.toEqual({
      type: 'message',
      messageType: 'info',
      content: 'Compacted 12 history items.',
    });
  });
});
