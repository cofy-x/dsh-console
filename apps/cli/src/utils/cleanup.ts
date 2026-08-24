/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const cleanupFunctions: Array<(() => void) | (() => Promise<void>)> = [];
const syncCleanupFunctions: Array<() => void> = [];

export function registerCleanup(fn: (() => void) | (() => Promise<void>)) {
  cleanupFunctions.push(fn);
}

export function registerSyncCleanup(fn: () => void) {
  syncCleanupFunctions.push(fn);
}

export function resetCleanupForTesting() {
  cleanupFunctions.length = 0;
  syncCleanupFunctions.length = 0;
}

export function runSyncCleanup() {
  for (const fn of syncCleanupFunctions) {
    try {
      fn();
    } catch (_) {
      // Ignore errors during cleanup.
    }
  }
  syncCleanupFunctions.length = 0;
}

export async function runExitCleanup() {
  // drain stdin to prevent printing garbage on exit
  // https://github.com/google-gemini/gemini-cli/issues/1680
  await drainStdin();

  runSyncCleanup();
  for (const fn of cleanupFunctions) {
    try {
      await fn();
    } catch (_) {
      // Ignore errors during cleanup.
    }
  }
  cleanupFunctions.length = 0;
}

async function drainStdin() {
  if (!process.stdin?.isTTY) return;
  // Resume stdin and attach a no-op listener to drain the buffer.
  // We use removeAllListeners to ensure we don't trigger other handlers.
  process.stdin
    .resume()
    .removeAllListeners('data')
    .on('data', () => {});
  // Give it a moment to flush the OS buffer.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

/**
 * Exit code used to signal that the CLI should be relaunched.
 */
export const RESTART_EXIT_CODE = 199;
