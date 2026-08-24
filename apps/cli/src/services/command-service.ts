/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '@cofy-x/dsh-console-core';
import type { SlashCommand } from '../ui/commands/types.js';
import type { ICommandLoader } from './types.js';

/**
 * Orchestrates the discovery and loading of all slash commands for the CLI.
 *
 * This service combines commands from registered loaders. It is initialized
 * with an array of `ICommandLoader` instances, each responsible for fetching
 * commands from a specific source.
 *
 * The CommandService is responsible for invoking these loaders, aggregating their
 * results, and resolving any name conflicts. This architecture allows the command
 * system to be extended with new sources without modifying the service itself.
 */
export class CommandService {
  /**
   * Private constructor to enforce the use of the async factory.
   * @param commands A readonly array of the fully loaded and de-duplicated commands.
   */
  private constructor(private readonly commands: readonly SlashCommand[]) {}

  /**
   * Asynchronously creates and initializes a new CommandService instance.
   *
   * This factory method orchestrates the entire command loading process. It
   * runs all provided loaders in parallel, aggregates their results, handles
   * name conflicts using loader order, and then returns a fully constructed
   * `CommandService` instance.
   *
   * @param loaders Command sources ordered from lowest to highest precedence.
   * @param signal An AbortSignal to cancel the loading process.
   * @returns A promise that resolves to a new, fully initialized `CommandService` instance.
   */
  static async create(
    loaders: ICommandLoader[],
    signal: AbortSignal,
  ): Promise<CommandService> {
    const results = await Promise.allSettled(
      loaders.map((loader) => loader.loadCommands(signal)),
    );

    const allCommands: SlashCommand[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allCommands.push(...result.value);
      } else {
        debugLogger.debug('A command loader failed:', result.reason);
      }
    }

    const commandMap = new Map<string, SlashCommand>();
    for (const cmd of allCommands) {
      commandMap.set(cmd.name, cmd);
    }

    const finalCommands = Object.freeze(Array.from(commandMap.values()));
    return new CommandService(finalCommands);
  }

  /**
   * Retrieves the currently loaded and de-duplicated list of slash commands.
   *
   * This method is a safe accessor for the service's state. It returns a
   * readonly array, preventing consumers from modifying the service's internal state.
   *
   * @returns A readonly, unified array of available `SlashCommand` objects.
   */
  getCommands(): readonly SlashCommand[] {
    return this.commands;
  }
}
