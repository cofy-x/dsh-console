/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createStartupCommand,
  type DshConsoleStartupValues,
} from './startup.js';

async function parse(...args: string[]): Promise<DshConsoleStartupValues> {
  let values: DshConsoleStartupValues | undefined;
  await createStartupCommand((next) => {
    values = next;
  }, {}).parseAsync(['node', 'dsh-console', ...args]);
  return values!;
}

describe('createStartupCommand', () => {
  it('maps latest-session continuation with an initial prompt', async () => {
    await expect(parse('--continue', '--prompt', 'next step')).resolves.toEqual({
      continueSession: true,
      debug: false,
      prompt: 'next step',
    });
  });

  it('normalizes an explicit Session id', async () => {
    await expect(parse('--resume', '  dsh-console-history  ')).resolves.toEqual({
      debug: false,
      resumeSessionId: 'dsh-console-history',
    });
  });

  it('rejects ambiguous continuation options', async () => {
    const program = createStartupCommand(vi.fn(), {})
      .configureOutput({ writeErr: vi.fn() })
      .exitOverride();
    await expect(
      program.parseAsync([
        'node',
        'dsh-console',
        '--continue',
        '--resume',
        'dsh-console-history',
      ]),
    ).rejects.toMatchObject({ code: 'commander.conflictingOption' });
  });

  it('rejects an empty explicit Session id', async () => {
    const program = createStartupCommand(vi.fn(), {})
      .configureOutput({ writeErr: vi.fn() })
      .exitOverride();
    await expect(
      program.parseAsync(['node', 'dsh-console', '--resume', '']),
    ).rejects.toMatchObject({ code: 'commander.error' });
  });
});
