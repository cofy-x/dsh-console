/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import * as os from 'node:os';
import { DSH_CONSOLE_DIR, getFilePathHash, homedir } from './paths/paths.js';

const TMP_DIR_NAME = 'tmp';
export class Storage {
  private readonly targetDir: string;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
  }

  /**
   * Internal helper to generate the project temporary directory path.
   * Format: <GlobalTempDir>/<ProjectName>_<Hash>
   * Example: ~/.dsh-console/tmp/my-project_a1b2c3
   */
  private static generateProjectTempDir(projectRoot: string): string {
    const hash = getFilePathHash(projectRoot);

    // fallback if basename fails (e.g. root directory)
    let folderName = path.basename(projectRoot);
    if (!folderName || folderName === '.' || folderName === path.sep) {
      folderName = 'root';
    }

    // Sanitize: replace non-alphanumeric chars with underscore to ensure filesystem safety
    const safeFolderName = folderName.replace(/[^a-zA-Z0-9_-]/g, '_');

    const tempDir = Storage.getGlobalTempDir();
    return path.join(tempDir, `${safeFolderName}_${hash}`);
  }

  /**
   * Gets the temporary directory for the current project instance.
   */
  getProjectTempDir(): string {
    return Storage.generateProjectTempDir(this.getProjectRoot());
  }

  /**
   * Static version to get the temporary directory for a specific project root.
   */
  static getProjectTempDir(projectRoot: string): string {
    return Storage.generateProjectTempDir(projectRoot);
  }

  static getGlobalDshConsoleDir(): string {
    const homeDir = homedir();
    if (!homeDir) {
      // Fallback to system temp if home dir is not resolved
      return path.join(os.tmpdir(), DSH_CONSOLE_DIR);
    }
    return path.join(homeDir, DSH_CONSOLE_DIR);
  }

  static getGlobalSettingsPath(): string {
    return path.join(Storage.getGlobalDshConsoleDir(), 'settings.json');
  }

  static getGlobalTempDir(): string {
    return path.join(Storage.getGlobalDshConsoleDir(), TMP_DIR_NAME);
  }

  getDshConsoleDir(): string {
    return path.join(this.targetDir, DSH_CONSOLE_DIR);
  }

  getProjectRoot(): string {
    return this.targetDir;
  }

  getWorkspaceSettingsPath(): string {
    return path.join(this.getDshConsoleDir(), 'settings.json');
  }

  getHistoryFilePath(): string {
    return path.join(this.getProjectTempDir(), 'shell_history');
  }
}
