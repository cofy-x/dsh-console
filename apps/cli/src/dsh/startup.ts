/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';
import type { Context } from '@deepseek-ai/cordis';
import { parseCmdline } from '@deepseek-ai/dsh-cmdline';

export const name = 'dsh-console-startup';
export const inject = ['cmdlineArgs'];
export const DSH_CONSOLE_STARTUP_SERVICE = 'dshConsoleStartup';

export interface DshConsoleStartupValues {
  prompt?: string;
  debug: boolean;
}

export function apply(ctx: Context): void {
  const program = new Command()
    .name('dsh-console')
    .description('Run DeepSeek Harness with the DSH Console terminal frontend.')
    .helpOption('-h, --help', 'show this help')
    .option('-d, --debug', 'enable DSH Console diagnostics', false)
    .option('-p, --prompt <text>', 'submit an initial prompt after startup');

  program.action((options: { prompt?: string; debug: boolean }) => {
    ctx.provide(DSH_CONSOLE_STARTUP_SERVICE, {
      ...(options.prompt === undefined ? {} : { prompt: options.prompt }),
      debug: options.debug,
    } satisfies DshConsoleStartupValues);
  });
  parseCmdline(ctx, program);
}
