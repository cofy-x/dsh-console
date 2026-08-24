/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import {
  getShellConfiguration,
  resolveExecutable,
} from './utils.js';
import path from 'node:path';

const mockPlatform = vi.hoisted(() => vi.fn());
vi.mock('os', () => ({
  default: {
    platform: mockPlatform,
  },
  platform: mockPlatform,
}));

const mockAccess = vi.hoisted(() => vi.fn());
vi.mock('node:fs', () => ({
  default: {
    promises: {
      access: mockAccess,
    },
    constants: { X_OK: 1 },
  },
  promises: {
    access: mockAccess,
  },
  constants: { X_OK: 1 },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('getShellConfiguration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return bash configuration on Linux', () => {
    mockPlatform.mockReturnValue('linux');
    const config = getShellConfiguration();
    expect(config.executable).toBe('bash');
    expect(config.argsPrefix).toEqual(['-c']);
    expect(config.shell).toBe('bash');
  });

  it('should return bash configuration on macOS (darwin)', () => {
    mockPlatform.mockReturnValue('darwin');
    const config = getShellConfiguration();
    expect(config.executable).toBe('bash');
    expect(config.argsPrefix).toEqual(['-c']);
    expect(config.shell).toBe('bash');
  });

  describe('on Windows', () => {
    beforeEach(() => {
      mockPlatform.mockReturnValue('win32');
    });

    it('should return PowerShell configuration by default', () => {
      delete process.env['ComSpec'];
      const config = getShellConfiguration();
      expect(config.executable).toBe('powershell.exe');
      expect(config.argsPrefix).toEqual(['-NoProfile', '-Command']);
      expect(config.shell).toBe('powershell');
    });

    it('should ignore ComSpec when pointing to cmd.exe', () => {
      const cmdPath = 'C:\\WINDOWS\\system32\\cmd.exe';
      process.env['ComSpec'] = cmdPath;
      const config = getShellConfiguration();
      expect(config.executable).toBe('powershell.exe');
      expect(config.argsPrefix).toEqual(['-NoProfile', '-Command']);
      expect(config.shell).toBe('powershell');
    });

    it('should return PowerShell configuration if ComSpec points to powershell.exe', () => {
      const psPath =
        'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      process.env['ComSpec'] = psPath;
      const config = getShellConfiguration();
      expect(config.executable).toBe(psPath);
      expect(config.argsPrefix).toEqual(['-NoProfile', '-Command']);
      expect(config.shell).toBe('powershell');
    });

    it('should return PowerShell configuration if ComSpec points to pwsh.exe', () => {
      const pwshPath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
      process.env['ComSpec'] = pwshPath;
      const config = getShellConfiguration();
      expect(config.executable).toBe(pwshPath);
      expect(config.argsPrefix).toEqual(['-NoProfile', '-Command']);
      expect(config.shell).toBe('powershell');
    });

    it('should be case-insensitive when checking ComSpec', () => {
      process.env['ComSpec'] = 'C:\\Path\\To\\POWERSHELL.EXE';
      const config = getShellConfiguration();
      expect(config.executable).toBe('C:\\Path\\To\\POWERSHELL.EXE');
      expect(config.argsPrefix).toEqual(['-NoProfile', '-Command']);
      expect(config.shell).toBe('powershell');
    });
  });
});

describe('resolveExecutable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockAccess.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return the absolute path if it exists and is executable', async () => {
    const absPath = path.resolve('/usr/bin/git');
    mockAccess.mockResolvedValue(undefined); // success
    expect(await resolveExecutable(absPath)).toBe(absPath);
    expect(mockAccess).toHaveBeenCalledWith(absPath, 1);
  });

  it('should return undefined for absolute path if it does not exist', async () => {
    const absPath = path.resolve('/usr/bin/nonexistent');
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    expect(await resolveExecutable(absPath)).toBeUndefined();
  });

  it('should resolve executable in PATH', async () => {
    const binDir = path.resolve('/bin');
    const usrBinDir = path.resolve('/usr/bin');
    process.env['PATH'] = `${binDir}${path.delimiter}${usrBinDir}`;
    mockPlatform.mockReturnValue('linux');

    const targetPath = path.join(usrBinDir, 'ls');
    mockAccess.mockImplementation(async (p: string) => {
      if (p === targetPath) return undefined;
      throw new Error('ENOENT');
    });

    expect(await resolveExecutable('ls')).toBe(targetPath);
  });

  it('should try extensions on Windows', async () => {
    const sys32 = path.resolve('C:\\Windows\\System32');
    process.env['PATH'] = sys32;
    mockPlatform.mockReturnValue('win32');
    mockAccess.mockImplementation(async (p: string) => {
      // Use includes because on Windows path separators might differ
      if (p.includes('cmd.exe')) return undefined;
      throw new Error('ENOENT');
    });

    expect(await resolveExecutable('cmd')).toContain('cmd.exe');
  });

  it('should return undefined if not found in PATH', async () => {
    process.env['PATH'] = path.resolve('/bin');
    mockPlatform.mockReturnValue('linux');
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    expect(await resolveExecutable('unknown')).toBeUndefined();
  });
});
