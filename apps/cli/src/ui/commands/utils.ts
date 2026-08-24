/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand } from './types.js';

/**
 * Checks if a query string potentially represents an '/' command.
 * It triggers if the query starts with '/' but excludes code comments like '//' and '/*'.
 *
 * @param query The input query string.
 * @returns True if the query looks like an '/' command, false otherwise.
 */
export const isSlashCommand = (query: string): boolean => {
  if (!query.startsWith('/')) {
    return false;
  }

  // Exclude line comments that start with '//'
  if (query.startsWith('//')) {
    return false;
  }

  // Exclude block comments that start with '/*'
  if (query.startsWith('/*')) {
    return false;
  }

  return true;
};

/**
 * Determines if a slash command should auto-execute when selected.
 *
 * Built-in and DSH commands may opt into immediate execution. Commands without
 * the flag stay in the composer so the user can provide arguments safely.
 *
 * @param command The slash command to check
 * @returns true if the command should auto-execute on Enter
 */
export function isAutoExecutableCommand(
  command: SlashCommand | undefined | null,
): boolean {
  if (!command) {
    return false;
  }

  // Simply return the autoExecute flag value, defaulting to false if undefined
  return command.autoExecute ?? false;
}
