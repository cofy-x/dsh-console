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
          },
          {
            name: 'status',
            description: 'Show status',
          },
        ],
      }),
      subscribe: () => vi.fn(),
      prepare: vi.fn(async () => undefined),
      execute: vi.fn(),
      dispose: vi.fn(),
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
});
