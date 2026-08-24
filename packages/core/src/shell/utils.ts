/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import * as readline from 'node:readline';
import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import type { ShellConfiguration } from './types.js';

/**
 * Determines the appropriate shell configuration for the current platform.
 *
 * This ensures we can execute command strings predictably and securely across platforms
 * using the `spawn(executable, [...argsPrefix, commandString], { shell: false })` pattern.
 *
 * @returns The ShellConfiguration for the current environment.
 */
export function getShellConfiguration(): ShellConfiguration {
  if (isWindows()) {
    const comSpec = process.env['ComSpec'];
    if (comSpec) {
      const executable = comSpec.toLowerCase();
      if (
        executable.endsWith('powershell.exe') ||
        executable.endsWith('pwsh.exe')
      ) {
        return {
          executable: comSpec,
          argsPrefix: ['-NoProfile', '-Command'],
          shell: 'powershell',
        };
      }
    }

    // Default to PowerShell for all other Windows configurations.
    return {
      executable: 'powershell.exe',
      argsPrefix: ['-NoProfile', '-Command'],
      shell: 'powershell',
    };
  }

  // Unix-like systems (Linux, macOS)
  return { executable: 'bash', argsPrefix: ['-c'], shell: 'bash' };
}

export async function resolveExecutable(
  exe: string,
): Promise<string | undefined> {
  if (path.isAbsolute(exe)) {
    try {
      await fs.promises.access(exe, fs.constants.X_OK);
      return exe;
    } catch {
      return undefined;
    }
  }
  const paths = (process.env['PATH'] || '').split(path.delimiter);
  const extensions =
    os.platform() === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];

  for (const p of paths) {
    for (const ext of extensions) {
      const fullPath = path.join(p, exe + ext);
      try {
        await fs.promises.access(fullPath, fs.constants.X_OK);
        return fullPath;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

/**
 * Export the platform detection constant for use in process management (e.g., killing processes).
 */
export const isWindows = () => os.platform() === 'win32';

/** Runs a process without a shell and collects stdout and stderr. */
export const spawnAsync = (
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio,
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}:\n${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });

/**
 * Executes a command and yields lines of output as they appear.
 * Use for large outputs where buffering is not feasible.
 *
 * @param command The executable to run
 * @param args Arguments for the executable
 * @param options Spawn options (cwd, env, etc.)
 */
export async function* execStreaming(
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio & {
    signal?: AbortSignal;
    allowedExitCodes?: number[];
  },
): AsyncGenerator<string, void, void> {
  const child = spawn(command, args, {
    ...options,
    // ensure we don't open a window on windows if possible/relevant
    windowsHide: true,
  });

  const rl = readline.createInterface({
    input: child.stdout,
    terminal: false,
  });

  const errorChunks: Buffer[] = [];
  let stderrTotalBytes = 0;
  const MAX_STDERR_BYTES = 20 * 1024; // 20KB limit

  child.stderr.on('data', (chunk) => {
    if (stderrTotalBytes < MAX_STDERR_BYTES) {
      errorChunks.push(chunk);
      stderrTotalBytes += chunk.length;
    }
  });

  let error: Error | null = null;
  child.on('error', (err) => {
    error = err;
  });

  const onAbort = () => {
    // If manually aborted by signal, we kill immediately.
    if (!child.killed) child.kill();
  };

  if (options?.signal?.aborted) {
    onAbort();
  } else {
    options?.signal?.addEventListener('abort', onAbort);
  }

  let finished = false;
  try {
    for await (const line of rl) {
      if (options?.signal?.aborted) break;
      yield line;
    }
    finished = true;
  } finally {
    rl.close();
    options?.signal?.removeEventListener('abort', onAbort);

    // Ensure process is killed when the generator is closed (consumer breaks loop)
    let killedByGenerator = false;
    if (!finished && child.exitCode === null && !child.killed) {
      try {
        child.kill();
      } catch (_e) {
        // ignore error if process is already dead
      }
      killedByGenerator = true;
    }

    // Ensure we wait for the process to exit to check codes
    await new Promise<void>((resolve, reject) => {
      // If an error occurred before we got here (e.g. spawn failure), reject immediately.
      if (error) {
        reject(error);
        return;
      }

      function checkExit(code: number | null) {
        // If we aborted or killed it manually, we treat it as success (stop waiting)
        if (options?.signal?.aborted || killedByGenerator) {
          resolve();
          return;
        }

        const allowed = options?.allowedExitCodes ?? [0];
        if (code !== null && allowed.includes(code)) {
          resolve();
        } else {
          // If we have an accumulated error or explicit error event
          if (error) reject(error);
          else {
            const stderr = Buffer.concat(errorChunks).toString('utf8');
            const truncatedMsg =
              stderrTotalBytes >= MAX_STDERR_BYTES ? '...[truncated]' : '';
            reject(
              new Error(
                `Process exited with code ${code}: ${stderr}${truncatedMsg}`,
              ),
            );
          }
        }
      }

      if (child.exitCode !== null) {
        checkExit(child.exitCode);
      } else {
        child.on('close', (code) => checkExit(code));
        child.on('error', (err) => reject(err));
      }
    });
  }
}
