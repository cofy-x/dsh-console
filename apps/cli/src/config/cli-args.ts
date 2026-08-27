/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview CLI argument parsing and validation.
 *
 * This module handles parsing command-line arguments using yargs
 * and provides the CliArgs interface used throughout the CLI.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { type MergedSettings } from './settings-schema.js';
import { debugLogger } from '@cofy-x/dsh-console-core';
import { runExitCleanup } from '../utils/cleanup.js';
import { getVersion } from '../utils/version.js';
import {
  POKEMON_NUMBER_ENV,
  resolvePokemonNumber,
} from './pokemon-selection.js';
import { loadHeaderArt } from '../utils/header-loader.js';

// ============================================================================
// CLI Arguments Interface
// ============================================================================

/**
 * Parsed command-line arguments for the CLI.
 */
export interface CliArgs {
  query: string | undefined;
  debug: boolean | undefined;
  prompt: string | undefined;
  promptInteractive: string | undefined;
  pokemon?: number;

  screenReader: boolean | undefined;
  startupMessages?: string[];
  isCommand: boolean | undefined;
}

// ============================================================================
// Argument Parsing
// ============================================================================

/**
 * Parses command-line arguments using yargs.
 *
 * @param settings - The loaded settings (used to conditionally enable commands)
 * @returns Parsed CLI arguments
 */
export async function parseArguments(
  settings: MergedSettings,
  args: string[] = hideBin(process.argv),
): Promise<CliArgs> {
  const startupMessages: string[] = [];
  const yargsInstance = yargs(args)
    .locale('en')
    .scriptName('dsh-console')
    .usage(
      'Usage: dsh-console [options] [command]\n\nDSH Console defaults to interactive mode.',
    )
    .option('debug', {
      alias: 'd',
      type: 'boolean',
      description: 'Enable DSH Console diagnostics',
      default: false,
    })
    .option('pokemon', {
      type: 'string',
      nargs: 1,
      description: 'Use a bundled Pokemon number for this launch',
    })
    .command('$0 [query..]', 'Launch DSH Console', (yargsInstance) =>
      yargsInstance
        .positional('query', {
          description:
            'Initial prompt. Runs in interactive mode by default; use -p/--prompt for non-interactive.',
        })
        .option('prompt', {
          alias: 'p',
          type: 'string',
          nargs: 1,
          description:
            'Run in non-interactive (headless) mode with the given prompt. Appended to input on stdin (if any).',
        })
        .option('prompt-interactive', {
          alias: 'i',
          type: 'string',
          nargs: 1,
          description:
            'Execute the provided prompt and continue in interactive mode',
        })
        .option('screen-reader', {
          type: 'boolean',
          description: 'Enable screen reader mode for accessibility.',
        }),
    )
    // Ensure validation flows through .fail() for clean UX
    .fail((msg, err) => {
      if (err) throw err;
      throw new Error(msg);
    })
    .check((argv) => {
      // The 'query' positional can be a string (for one arg) or string[] (for multiple).
      // This guard safely checks if any positional argument was provided.
      const query = argv['query'] as string | string[] | undefined;
      const hasPositionalQuery = Array.isArray(query)
        ? query.length > 0
        : !!query;

      if (argv['prompt'] && hasPositionalQuery) {
        return 'Cannot use both a positional prompt and the --prompt (-p) flag together';
      }
      if (argv['prompt'] && argv['promptInteractive']) {
        return 'Cannot use both --prompt (-p) and --prompt-interactive (-i) together';
      }
      return true;
    });

  yargsInstance
    .version(await getVersion()) // This will enable the --version flag based on package.json
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .strict()
    .demandCommand(0, 0) // Allow base command to run with no subcommands
    .exitProcess(false);

  yargsInstance.wrap(yargsInstance.terminalWidth());
  let result;
  try {
    result = await yargsInstance.parse();
    const pokemonNumber = resolvePokemonNumber(
      result['pokemon'],
      process.env[POKEMON_NUMBER_ENV],
    );
    if (pokemonNumber !== undefined) {
      loadHeaderArt('pokemon', undefined, pokemonNumber);
      (result as Record<string, unknown>)['pokemon'] = pokemonNumber;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    debugLogger.error(msg);
    yargsInstance.showHelp();
    await runExitCleanup();
    process.exit(1);
  }

  // Handle help and version flags manually since we disabled exitProcess
  if (result['help'] || result['version']) {
    await runExitCleanup();
    process.exit(0);
  }

  // Normalize query args: handle both quoted "@path file" and unquoted @path file
  const queryArg = (result as { query?: string | string[] | undefined }).query;
  const q: string | undefined = Array.isArray(queryArg)
    ? queryArg.join(' ')
    : queryArg;

  // -p/--prompt forces non-interactive mode; positional args default to interactive in TTY
  if (q && !result['prompt']) {
    if (process.stdin.isTTY) {
      startupMessages.push(
        'Positional arguments now default to interactive mode. To run in non-interactive mode, use the --prompt (-p) flag.',
      );
      result['promptInteractive'] = q;
    } else {
      result['prompt'] = q;
    }
  }

  // Keep CliArgs.query as a string for downstream typing
  (result as Record<string, unknown>)['query'] = q || undefined;
  (result as Record<string, unknown>)['startupMessages'] = startupMessages;
  return result as unknown as CliArgs;
}

// ============================================================================
// Debug Mode Detection
// ============================================================================

/**
 * Determines if debug mode is enabled based on CLI args or environment variables.
 *
 * @param argv - Parsed CLI arguments
 * @returns true if debug mode is enabled
 */
export function isDebugMode(argv: CliArgs): boolean {
  return (
    argv.debug ||
    [process.env['DEBUG'], process.env['DEBUG_MODE']].some(
      (v) => v === 'true' || v === '1',
    )
  );
}
