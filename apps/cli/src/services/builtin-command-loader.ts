/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICommandLoader } from './types.js';
import type { SlashCommand } from '../ui/commands/types.js';
import { debugLogger } from '@cofy-x/dsh-console-core';
import { helpCommand } from '../ui/commands/help-command.js';
import { aboutCommand } from '../ui/commands/about-command.js';
import { changelogCommand } from '../ui/commands/changelog-command.js';
import { quitCommand } from '../ui/commands/quit-command.js';
import { themeCommand } from '../ui/commands/theme-command.js';
import { settingsCommand } from '../ui/commands/settings-command.js';
import { vimCommand } from '../ui/commands/vim-command.js';
import { modelCommand } from '../ui/commands/model-command.js';
import { providerCommand } from '../ui/commands/provider-command.js';
import {
  newCommand,
  sessionsCommand,
} from '../ui/commands/session-commands.js';
import { statsCommand } from '../ui/commands/stats-command.js';
import { toolsCommand } from '../ui/commands/tools-command.js';
import { permissionCommand } from '../ui/commands/permission-command.js';
import { profilerCommand } from '../ui/commands/profiler-command.js';
import {
  btwCommand,
  mainCommand,
  sideCommand,
} from '../ui/commands/btw-command.js';
import { agentsCommand } from '../ui/commands/agents-command.js';

/**
 * Loads the core, hard-coded slash commands that are an integral part
 * of the DSH Console application.
 */
export class BuiltinCommandLoader implements ICommandLoader {
  private isFirstLoad = true;

  constructor(private readonly enableProfiler = false) {}

  /**
   * Gathers all raw built-in command definitions, injects dependencies where
   * needed (e.g., config) and filters out any that are not available.
   *
   * @param _signal An AbortSignal (unused for this synchronous loader).
   * @returns A promise that resolves to an array of `SlashCommand` objects.
   */
  async loadCommands(_signal: AbortSignal): Promise<SlashCommand[]> {
    const startTime = performance.now();

    const isInitialLoad = this.isFirstLoad;
    this.isFirstLoad = false;

    // Built-ins are intentionally limited to commands backed by Console-owned
    // UI state or an injected DSH runtime.
    const commands: SlashCommand[] = [
      helpCommand,
      aboutCommand,
      changelogCommand,
      statsCommand,
      toolsCommand,
      agentsCommand,
      btwCommand,
      mainCommand,
      sideCommand,
      ...(this.enableProfiler ? [profilerCommand] : []),
      quitCommand,
      themeCommand,
      settingsCommand,
      vimCommand,
      modelCommand,
      providerCommand,
      permissionCommand,
      newCommand,
      sessionsCommand,
    ];

    const duration = (performance.now() - startTime).toFixed(2);
    const logMessage = `[BuiltinCommandLoader] ${isInitialLoad ? 'Loaded' : 'Reloaded'} ${commands.length} commands in ${duration}ms`;

    // Note: We use debugLogger instead of startupProfiler because command loading
    // happens during React rendering (useEffect), which occurs AFTER the
    // startupProfiler.flush() sequence.
    if (isInitialLoad) {
      debugLogger.log(logMessage);
    } else {
      debugLogger.debug(logMessage);
    }

    return commands;
  }
}
