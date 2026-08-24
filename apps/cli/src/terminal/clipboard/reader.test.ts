/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import * as fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import EventEmitter from 'node:events';
import { Stream } from 'node:stream';
import * as path from 'node:path';

// Mock dependencies BEFORE imports
vi.mock('node:fs/promises');
vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(),
}));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
    execSync: vi.fn(),
  };
});
vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
  return {
    ...actual,
    spawnAsync: vi.fn(),
    debugLogger: {
      debug: vi.fn(),
      warn: vi.fn(),
    },
    Storage: class {
      getProjectTempDir = vi.fn(() => '/tmp/global');
    },
  };
});

import { spawnAsync } from '@cofy-x/dsh-console-core';
// Keep static imports for stateless functions
import { cleanupOldClipboardImages } from './reader.js';

// Define the type for the module to use in tests
type ClipboardUtilsModule = typeof import('./reader.js');

describe('clipboard/reader', () => {
  let originalPlatform: string;
  let originalEnv: NodeJS.ProcessEnv;
  // Dynamic module instance for stateful functions
  let clipboardUtils: ClipboardUtilsModule;

  beforeEach(async () => {
    vi.resetAllMocks();
    originalPlatform = process.platform;
    originalEnv = process.env;
    process.env = { ...originalEnv };

    // Reset modules to clear internal state (linuxClipboardTool variable)
    vi.resetModules();
    // Dynamically import the module to get a fresh instance for each test
    clipboardUtils = await import('./reader.js');
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const setPlatform = (platform: string) => {
    Object.defineProperty(process, 'platform', {
      value: platform,
    });
  };

  describe('clipboardHasImage (Linux)', () => {
    it('should return true when wl-paste shows image type (Wayland)', async () => {
      setPlatform('linux');
      process.env['XDG_SESSION_TYPE'] = 'wayland';
      (execSync as Mock).mockReturnValue(Buffer.from('')); // command -v succeeds
      (spawnAsync as Mock).mockResolvedValueOnce({
        stdout: 'image/png\ntext/plain',
      });

      const result = await clipboardUtils.clipboardHasImage();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('wl-paste'),
        expect.anything(),
      );
      expect(spawnAsync).toHaveBeenCalledWith('wl-paste', ['--list-types']);
    });

    it('should return true when xclip shows image type (X11)', async () => {
      setPlatform('linux');
      process.env['XDG_SESSION_TYPE'] = 'x11';
      (execSync as Mock).mockReturnValue(Buffer.from('')); // command -v succeeds
      (spawnAsync as Mock).mockResolvedValueOnce({
        stdout: 'image/png\nTARGETS',
      });

      const result = await clipboardUtils.clipboardHasImage();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('xclip'),
        expect.anything(),
      );
      expect(spawnAsync).toHaveBeenCalledWith('xclip', [
        '-selection',
        'clipboard',
        '-t',
        'TARGETS',
        '-o',
      ]);
    });

    it('should return false if tool fails', async () => {
      setPlatform('linux');
      process.env['XDG_SESSION_TYPE'] = 'wayland';
      (execSync as Mock).mockReturnValue(Buffer.from(''));
      (spawnAsync as Mock).mockRejectedValueOnce(new Error('wl-paste failed'));

      const result = await clipboardUtils.clipboardHasImage();

      expect(result).toBe(false);
    });

    it('should return false if no image type is found', async () => {
      setPlatform('linux');
      process.env['XDG_SESSION_TYPE'] = 'wayland';
      (execSync as Mock).mockReturnValue(Buffer.from(''));
      (spawnAsync as Mock).mockResolvedValueOnce({ stdout: 'text/plain' });

      const result = await clipboardUtils.clipboardHasImage();

      expect(result).toBe(false);
    });

    it('should return false if tool not found', async () => {
      setPlatform('linux');
      process.env['XDG_SESSION_TYPE'] = 'wayland';
      (execSync as Mock).mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await clipboardUtils.clipboardHasImage();

      expect(result).toBe(false);
    });
  });

  describe('saveClipboardImage (Linux)', () => {
    const mockTargetDir = '/tmp/target';
    const mockTempDir = path.join('/tmp/global', 'images');

    beforeEach(() => {
      setPlatform('linux');
      (fs.mkdir as Mock).mockResolvedValue(undefined);
      (fs.unlink as Mock).mockResolvedValue(undefined);
    });

    const createMockChildProcess = (
      shouldSucceed: boolean,
      exitCode: number = 0,
    ) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: Stream & { pipe: Mock };
      };
      child.stdout = new Stream() as Stream & { pipe: Mock }; // Dummy stream
      child.stdout.pipe = vi.fn();

      // Simulate process execution
      setTimeout(() => {
        if (!shouldSucceed) {
          child.emit('error', new Error('Spawn failed'));
        } else {
          child.emit('close', exitCode);
        }
      }, 10);

      return child;
    };

    // Helper to prime the internal linuxClipboardTool state
    const primeClipboardTool = async (
      type: 'wayland' | 'x11',
      hasImage = true,
    ) => {
      process.env['XDG_SESSION_TYPE'] = type;
      (execSync as Mock).mockReturnValue(Buffer.from(''));
      (spawnAsync as Mock).mockResolvedValueOnce({
        stdout: hasImage ? 'image/png' : 'text/plain',
      });
      await clipboardUtils.clipboardHasImage();
      (spawnAsync as Mock).mockClear();
      (execSync as Mock).mockClear();
    };

    it('should save image using wl-paste if detected', async () => {
      await primeClipboardTool('wayland');

      // Mock fs.stat to return size > 0
      (fs.stat as Mock).mockResolvedValue({ size: 100, mtimeMs: Date.now() });

      // Mock spawn to return a successful process for wl-paste
      const mockChild = createMockChildProcess(true, 0);
      (spawn as Mock).mockReturnValueOnce(mockChild);

      // Mock createWriteStream
      const mockStream = new EventEmitter() as EventEmitter & {
        writableFinished: boolean;
      };
      mockStream.writableFinished = false;
      (createWriteStream as Mock).mockReturnValue(mockStream);

      // Use dynamic instance
      const promise = clipboardUtils.saveClipboardImage(mockTargetDir);

      // Simulate stream finishing successfully BEFORE process closes
      mockStream.writableFinished = true;
      mockStream.emit('finish');

      const result = await promise;

      expect(result).toContain(mockTempDir);
      expect(spawn).toHaveBeenCalledWith('wl-paste', expect.any(Array));
      expect(fs.mkdir).toHaveBeenCalledWith(mockTempDir, { recursive: true });
    });

    it('should return null if wl-paste fails', async () => {
      await primeClipboardTool('wayland');

      // Mock fs.stat to return size > 0
      (fs.stat as Mock).mockResolvedValue({ size: 100, mtimeMs: Date.now() });

      // wl-paste fails (non-zero exit code)
      const child1 = createMockChildProcess(true, 1);
      (spawn as Mock).mockReturnValueOnce(child1);

      const mockStream1 = new EventEmitter() as EventEmitter & {
        writableFinished: boolean;
      };
      (createWriteStream as Mock).mockReturnValueOnce(mockStream1);

      const promise = clipboardUtils.saveClipboardImage(mockTargetDir);

      mockStream1.writableFinished = true;
      mockStream1.emit('finish');

      const result = await promise;

      expect(result).toBe(null);
      // Should NOT try xclip
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should save image using xclip if detected', async () => {
      await primeClipboardTool('x11');

      // Mock fs.stat to return size > 0
      (fs.stat as Mock).mockResolvedValue({ size: 100, mtimeMs: Date.now() });

      // Mock spawn to return a successful process for xclip
      const mockChild = createMockChildProcess(true, 0);
      (spawn as Mock).mockReturnValueOnce(mockChild);

      // Mock createWriteStream
      const mockStream = new EventEmitter() as EventEmitter & {
        writableFinished: boolean;
      };
      mockStream.writableFinished = false;
      (createWriteStream as Mock).mockReturnValue(mockStream);

      const promise = clipboardUtils.saveClipboardImage(mockTargetDir);

      mockStream.writableFinished = true;
      mockStream.emit('finish');

      const result = await promise;

      expect(result).toMatch(/clipboard-\d+\.png$/);
      expect(spawn).toHaveBeenCalledWith('xclip', expect.any(Array));
    });

    it('should return null if tool is not yet detected', async () => {
      // Don't prime the tool
      const result = await clipboardUtils.saveClipboardImage(mockTargetDir);
      expect(result).toBe(null);
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  // Stateless functions continue to use static imports
  describe('cleanupOldClipboardImages', () => {
    const mockTargetDir = '/tmp/target';
    it('should not throw errors', async () => {
      // Should handle missing directories gracefully
      await expect(
        cleanupOldClipboardImages(mockTargetDir),
      ).resolves.not.toThrow();
    });

    it('should complete without errors on valid directory', async () => {
      await expect(
        cleanupOldClipboardImages(mockTargetDir),
      ).resolves.not.toThrow();
    });
  });
});
