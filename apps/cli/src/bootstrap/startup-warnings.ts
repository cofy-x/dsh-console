/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';
import path, { join as pathJoin } from 'node:path';
import { getErrorMessage, homedir } from '@cofy-x/dsh-console-core';
import type { Settings } from '../config/settings-schema.js';

const WARNINGS_FILE_PATH = pathJoin(
  os.tmpdir(),
  'dsh-console-warnings.txt',
);

/**
 * Reads and cleans up warnings left by the startup wrapper/script.
 */
export async function getStoredStartupWarnings(): Promise<string[]> {
  try {
    await fs.access(WARNINGS_FILE_PATH); // Check if file exists
    const warningsContent = await fs.readFile(WARNINGS_FILE_PATH, 'utf-8');
    const warnings = warningsContent
      .split('\n')
      .filter((line) => line.trim() !== '');
    try {
      await fs.unlink(WARNINGS_FILE_PATH);
    } catch {
      warnings.push('Warning: Could not delete temporary warnings file.');
    }
    return warnings;
  } catch (err: unknown) {
    // If fs.access throws, it means the file doesn't exist or is not accessible.
    // This is not an error in the context of fetching warnings, so return empty.
    // Only return an error message if it's not a "file not found" type error.
    // However, the original logic returned an error message for any fs.existsSync failure.
    // To maintain closer parity while making it async, we'll check the error code.
    // ENOENT is "Error NO ENTry" (file not found).
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return []; // File not found, no warnings to return.
    }
    // For other errors (permissions, etc.), return the error message.
    return [`Error checking/reading warnings file: ${getErrorMessage(err)}`];
  }
}

type WarningCheck = {
  id: string;
  check: (workspaceRoot: string, settings: Settings) => Promise<string | null>;
};

// Individual warning checks
const homeDirectoryCheck: WarningCheck = {
  id: 'home-directory',
  check: async (workspaceRoot: string, settings: Settings) => {
    if (settings.ui?.showHomeDirectoryWarning === false) {
      return null;
    }

    try {
      const [workspaceRealPath, homeRealPath] = await Promise.all([
        fs.realpath(workspaceRoot),
        fs.realpath(homedir()),
      ]);

      if (workspaceRealPath === homeRealPath) {
        return 'Warning you are running DSH Console in your home directory.\nThis warning can be disabled in /settings';
      }
      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

const rootDirectoryCheck: WarningCheck = {
  id: 'root-directory',
  check: async (workspaceRoot: string, _settings: Settings) => {
    try {
      const workspaceRealPath = await fs.realpath(workspaceRoot);
      const errorMessage =
        'Warning: You are running DSH Console in the root directory. Your entire folder structure will be used for context. It is strongly recommended to run in a project-specific directory.';

      // Check for Unix root directory
      if (path.dirname(workspaceRealPath) === workspaceRealPath) {
        return errorMessage;
      }

      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

// All warning checks
const ENVIRONMENT_CHECKS: readonly WarningCheck[] = [
  homeDirectoryCheck,
  rootDirectoryCheck,
];

/**
 * Checks the current environment for potential issues.
 */
export async function getEnvironmentStartupWarnings(
  settings: Settings,
  workspaceRoot: string = process.cwd(),
): Promise<string[]> {
  const results = await Promise.all(
    ENVIRONMENT_CHECKS.map((check) => check.check(workspaceRoot, settings)),
  );
  return results.filter((msg) => msg !== null);
}

/**
 * Aggregates all startup warnings from various sources (stored files, env checks).
 */
export async function getStartupWarnings(
  settings: Settings,
  workspaceRoot: string = process.cwd(),
): Promise<string[]> {
  const [storedWarnings, envWarnings] = await Promise.all([
    getStoredStartupWarnings(),
    getEnvironmentStartupWarnings(settings, workspaceRoot),
  ]);

  return [...storedWarnings, ...envWarnings];
}
