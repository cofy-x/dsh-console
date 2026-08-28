/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command, Option } from 'commander';
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
  continueSession?: boolean;
  resumeSessionId?: string;
}

interface StartupCommandOptions {
  prompt?: string;
  debug: boolean;
  pokemon?: string;
  continue?: boolean;
  resume?: string;
}

export function createStartupCommand(
  provide: (values: DshConsoleStartupValues) => void,
  env: NodeJS.ProcessEnv = process.env,
): Command {
  const program = new Command()
    .name('dsh-console')
    .description('Run DeepSeek Harness with the DSH Console terminal frontend.')
    .helpOption('-h, --help', 'show this help')
    .option('-d, --debug', 'enable DSH Console diagnostics', false)
    .option(
      '--pokemon <number>',
      'use a bundled Pokemon number for this launch',
    )
    .option('-p, --prompt <text>', 'submit an initial prompt after startup')
    .addOption(
      new Option(
        '-c, --continue',
        'resume the latest Session for this directory',
      ).conflicts('resume'),
    )
    .addOption(
      new Option(
        '--resume <session-id>',
        'resume a specific Session for this directory',
      ).conflicts('continue'),
    )
    .action((options: StartupCommandOptions) => {
      const resumeSessionId = options.resume?.trim();
      if (options.resume !== undefined && !resumeSessionId) {
        program.error(
          "error: option '--resume <session-id>' requires a non-empty Session id",
        );
      }
      const pokemon = resolvePokemonNumber(
        options.pokemon,
        env[POKEMON_NUMBER_ENV],
      );
      provide({
        ...(options.prompt === undefined ? {} : { prompt: options.prompt }),
        ...(pokemon === undefined ? {} : { pokemon }),
        ...(options.continue === true ? { continueSession: true } : {}),
        ...(resumeSessionId === undefined ? {} : { resumeSessionId }),
        debug: options.debug,
      } satisfies DshConsoleStartupValues);
    });
  return program;
}

export function apply(ctx: Context): void {
  parseCmdline(
    ctx,
    createStartupCommand((values) =>
      ctx.provide(DSH_CONSOLE_STARTUP_SERVICE, values),
    ),
  );
}
