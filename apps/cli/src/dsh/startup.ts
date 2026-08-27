/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';
import type { Context } from '@deepseek-ai/cordis';
import { parseCmdline } from '@deepseek-ai/dsh-cmdline';
import {
  POKEMON_NUMBER_ENV,
  resolvePokemonNumber,
} from '../config/pokemon-selection.js';

export const name = 'dsh-console-startup';
export const inject = ['cmdlineArgs'];
export const DSH_CONSOLE_STARTUP_SERVICE = 'dshConsoleStartup';

export interface DshConsoleStartupValues {
  prompt?: string;
  debug: boolean;
  pokemon?: number;
}

export function apply(ctx: Context): void {
  const program = new Command()
    .name('dsh-console')
    .description('Run DeepSeek Harness with the DSH Console terminal frontend.')
    .helpOption('-h, --help', 'show this help')
    .option('-d, --debug', 'enable DSH Console diagnostics', false)
    .option(
      '--pokemon <number>',
      'use a bundled Pokemon number for this launch',
    )
    .option('-p, --prompt <text>', 'submit an initial prompt after startup');

  program.action(
    (options: { prompt?: string; debug: boolean; pokemon?: string }) => {
      const pokemon = resolvePokemonNumber(
        options.pokemon,
        process.env[POKEMON_NUMBER_ENV],
      );
      ctx.provide(DSH_CONSOLE_STARTUP_SERVICE, {
        ...(options.prompt === undefined ? {} : { prompt: options.prompt }),
        ...(pokemon === undefined ? {} : { pokemon }),
        debug: options.debug,
      } satisfies DshConsoleStartupValues);
    },
  );
  parseCmdline(ctx, program);
}
