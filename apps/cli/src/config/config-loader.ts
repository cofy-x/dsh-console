/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type MergedSettings } from './settings-schema.js';
import type { CliArgs } from './cli-args.js';
import { isDebugMode } from './cli-args.js';
import { Config } from './config.js';
import {
  DEFAULT_FILE_FILTERING_OPTIONS,
  getPty,
} from '@cofy-x/dsh-console-core';

export interface LoadCliConfigOptions {
  cwd?: string;
}

/** Combines local presentation settings with CLI arguments. */
export async function loadCliConfig(
  settings: MergedSettings,
  argv: CliArgs,
  options: LoadCliConfigOptions = {},
): Promise<Config> {
  const { cwd = process.cwd() } = options;
  const debugMode = isDebugMode(argv);
  const fileFiltering = {
    ...DEFAULT_FILE_FILTERING_OPTIONS,
    ...settings.context?.fileFiltering,
  };
  const question = argv.promptInteractive || argv.prompt || '';
  const interactive =
    !!argv.promptInteractive ||
    (process.stdin.isTTY && !argv.query && !argv.prompt && !argv.isCommand);
  const screenReader =
    argv.screenReader !== undefined
      ? argv.screenReader
      : (settings.ui?.accessibility?.screenReader ?? false);
  const ptyInfo = await getPty();

  return new Config({
    targetDir: cwd,
    debugMode,
    question,
    pokemonNumber: argv.pokemon,
    blockedEnvironmentVariables:
      settings.security?.environmentVariableRedaction?.blocked,
    enableEnvironmentVariableRedaction:
      settings.security?.environmentVariableRedaction?.enabled,
    accessibility: {
      ...settings.ui?.accessibility,
      screenReader,
    },
    fileFiltering,
    proxy:
      process.env['HTTPS_PROXY'] ||
      process.env['https_proxy'] ||
      process.env['HTTP_PROXY'] ||
      process.env['http_proxy'],
    interactive,
    useBackgroundColor: settings.ui?.useBackgroundColor,
    enableInteractiveShell: settings.tools?.shell?.enableInteractiveShell,
    enablePromptCompletion: settings.general?.enablePromptCompletion,
    ptyInfo: ptyInfo?.name,
  });
}
