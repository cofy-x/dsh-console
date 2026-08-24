/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getStoredStartupWarnings,
  getEnvironmentStartupWarnings,
} from './startup-warnings.js';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import { getErrorMessage } from '@cofy-x/dsh-console-core';
import path from 'node:path';

vi.mock('node:fs/promises', { spy: true });
vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
  return {
    ...actual,
    getErrorMessage: vi.fn(),
    homedir: () => os.homedir(),
  };
});

// Mock os.homedir to control the home directory in tests
vi.mock('node:os', async (importOriginal) => {
  const actualOs = await importOriginal<typeof import('node:os')>();
  return {
    default: {
      ...actualOs,
      homedir: vi.fn(),
    },
  };
});

describe('getStoredStartupWarnings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return warnings from the file and delete it', async () => {
    const mockWarnings = 'Warning 1\nWarning 2';
    vi.mocked(fs.access).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(mockWarnings);
    vi.mocked(fs.unlink).mockResolvedValue();

    const warnings = await getStoredStartupWarnings();

    expect(fs.access).toHaveBeenCalled();
    expect(fs.readFile).toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalled();
    expect(warnings).toEqual(['Warning 1', 'Warning 2']);
  });

  it('should return an empty array if the file does not exist', async () => {
    const error = new Error('File not found');
    (error as Error & { code: string }).code = 'ENOENT';
    vi.mocked(fs.access).mockRejectedValue(error);

    const warnings = await getStoredStartupWarnings();

    expect(warnings).toEqual([]);
  });

  it('should return an error message if reading the file fails', async () => {
    const error = new Error('Permission denied');
    vi.mocked(fs.access).mockRejectedValue(error);
    vi.mocked(getErrorMessage).mockReturnValue('Permission denied');

    const warnings = await getStoredStartupWarnings();

    expect(warnings).toEqual([
      'Error checking/reading warnings file: Permission denied',
    ]);
  });

  it('should return a warning if deleting the file fails', async () => {
    const mockWarnings = 'Warning 1';
    vi.mocked(fs.access).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(mockWarnings);
    vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

    const warnings = await getStoredStartupWarnings();

    expect(warnings).toEqual([
      'Warning 1',
      'Warning: Could not delete temporary warnings file.',
    ]);
  });
});

describe('getEnvironmentStartupWarnings', () => {
  let testRootDir: string;
  let homeDir: string;

  beforeEach(async () => {
    testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'warnings-test-'));
    homeDir = path.join(testRootDir, 'home');
    await fs.mkdir(homeDir, { recursive: true });
    vi.mocked(os.homedir).mockReturnValue(homeDir);
  });

  afterEach(async () => {
    await fs.rm(testRootDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('home directory check', () => {
    it('should return a warning when running in home directory', async () => {
      const warnings = await getEnvironmentStartupWarnings({}, homeDir);
      expect(warnings).toContainEqual(
        expect.stringContaining(
          'Warning you are running DSH Console in your home directory',
        ),
      );
      expect(warnings).toContainEqual(
        expect.stringContaining('warning can be disabled in /settings'),
      );
    });

    it('should not return a warning when running in a project directory', async () => {
      const projectDir = path.join(testRootDir, 'project');
      await fs.mkdir(projectDir);
      const warnings = await getEnvironmentStartupWarnings({}, projectDir);
      expect(warnings).not.toContainEqual(
        expect.stringContaining('home directory'),
      );
    });

    it('should not return a warning when showHomeDirectoryWarning is false', async () => {
      const warnings = await getEnvironmentStartupWarnings(
        { ui: { showHomeDirectoryWarning: false } },
        homeDir,
      );
      expect(warnings).not.toContainEqual(
        expect.stringContaining('home directory'),
      );
    });

  });

  describe('root directory check', () => {
    it('should return a warning when running in a root directory', async () => {
      const rootDir = path.parse(testRootDir).root;
      const warnings = await getEnvironmentStartupWarnings({}, rootDir);
      expect(warnings).toContainEqual(
        expect.stringContaining('root directory'),
      );
      expect(warnings).toContainEqual(
        expect.stringContaining('folder structure will be used'),
      );
    });

    it('should not return a warning when running in a non-root directory', async () => {
      const projectDir = path.join(testRootDir, 'project');
      await fs.mkdir(projectDir);
      const warnings = await getEnvironmentStartupWarnings({}, projectDir);
      expect(warnings).not.toContainEqual(
        expect.stringContaining('root directory'),
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors when checking directory', async () => {
      const nonExistentPath = path.join(testRootDir, 'non-existent');
      const warnings = await getEnvironmentStartupWarnings({}, nonExistentPath);
      const expectedWarning =
        'Could not verify the current directory due to a file system error.';
      expect(warnings).toEqual([expectedWarning, expectedWarning]);
    });
  });
});
