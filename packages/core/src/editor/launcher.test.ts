/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import {
  checkHasEditorType,
  isEditorAvailable,
  type EditorType,
} from './launcher.js';
import { execSync } from 'node:child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const originalPlatform = process.platform;

describe('editor utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  describe('checkHasEditorType', () => {
    const testCases: Array<{
      editor: EditorType;
      commands: string[];
      win32Commands: string[];
    }> = [
      { editor: 'vscode', commands: ['code'], win32Commands: ['code.cmd'] },
      {
        editor: 'vscodium',
        commands: ['codium'],
        win32Commands: ['codium.cmd'],
      },
      {
        editor: 'windsurf',
        commands: ['windsurf'],
        win32Commands: ['windsurf'],
      },
      { editor: 'cursor', commands: ['cursor'], win32Commands: ['cursor'] },
      { editor: 'vim', commands: ['vim'], win32Commands: ['vim'] },
      { editor: 'neovim', commands: ['nvim'], win32Commands: ['nvim'] },
      { editor: 'zed', commands: ['zed', 'zeditor'], win32Commands: ['zed'] },
      { editor: 'emacs', commands: ['emacs'], win32Commands: ['emacs.exe'] },
      {
        editor: 'antigravity',
        commands: ['agy', 'antigravity'],
        win32Commands: ['agy.cmd', 'antigravity.cmd', 'antigravity'],
      },
      { editor: 'hx', commands: ['hx'], win32Commands: ['hx'] },
    ];

    for (const { editor, commands, win32Commands } of testCases) {
      describe(`${editor}`, () => {
        // Non-windows tests
        it(`should return true if first command "${commands[0]}" exists on non-windows`, () => {
          Object.defineProperty(process, 'platform', { value: 'linux' });
          (execSync as Mock).mockReturnValue(
            Buffer.from(`/usr/bin/${commands[0]}`),
          );
          expect(checkHasEditorType(editor)).toBe(true);
          expect(execSync).toHaveBeenCalledWith(`command -v ${commands[0]}`, {
            stdio: 'ignore',
          });
        });

        if (commands.length > 1) {
          it(`should return true if first command doesn't exist but second command "${commands[1]}" exists on non-windows`, () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            (execSync as Mock)
              .mockImplementationOnce(() => {
                throw new Error(); // first command not found
              })
              .mockReturnValueOnce(Buffer.from(`/usr/bin/${commands[1]}`)); // second command found
            expect(checkHasEditorType(editor)).toBe(true);
            expect(execSync).toHaveBeenCalledTimes(2);
          });
        }

        it(`should return false if none of the commands exist on non-windows`, () => {
          Object.defineProperty(process, 'platform', { value: 'linux' });
          (execSync as Mock).mockImplementation(() => {
            throw new Error(); // all commands not found
          });
          expect(checkHasEditorType(editor)).toBe(false);
          expect(execSync).toHaveBeenCalledTimes(commands.length);
        });

        // Windows tests
        it(`should return true if first command "${win32Commands[0]}" exists on windows`, () => {
          Object.defineProperty(process, 'platform', { value: 'win32' });
          (execSync as Mock).mockReturnValue(
            Buffer.from(`C:\\Program Files\\...\\${win32Commands[0]}`),
          );
          expect(checkHasEditorType(editor)).toBe(true);
          expect(execSync).toHaveBeenCalledWith(
            `where.exe ${win32Commands[0]}`,
            {
              stdio: 'ignore',
            },
          );
        });

        if (win32Commands.length > 1) {
          it(`should return true if first command doesn't exist but second command "${win32Commands[1]}" exists on windows`, () => {
            Object.defineProperty(process, 'platform', { value: 'win32' });
            (execSync as Mock)
              .mockImplementationOnce(() => {
                throw new Error(); // first command not found
              })
              .mockReturnValueOnce(
                Buffer.from(`C:\\Program Files\\...\\${win32Commands[1]}`),
              ); // second command found
            expect(checkHasEditorType(editor)).toBe(true);
            expect(execSync).toHaveBeenCalledTimes(2);
          });
        }

        it(`should return false if none of the commands exist on windows`, () => {
          Object.defineProperty(process, 'platform', { value: 'win32' });
          (execSync as Mock).mockImplementation(() => {
            throw new Error(); // all commands not found
          });
          expect(checkHasEditorType(editor)).toBe(false);
          expect(execSync).toHaveBeenCalledTimes(win32Commands.length);
        });
      });
    }
  });

  describe('isEditorAvailable', () => {
    it('should return false for undefined editor', () => {
      expect(isEditorAvailable(undefined)).toBe(false);
    });

    it('should return false for empty string editor', () => {
      expect(isEditorAvailable('')).toBe(false);
    });

    it('should return false for invalid editor type', () => {
      expect(isEditorAvailable('invalid-editor')).toBe(false);
    });

    it('should return true for vscode when installed', () => {
      (execSync as Mock).mockReturnValue(Buffer.from('/usr/bin/code'));
      expect(isEditorAvailable('vscode')).toBe(true);
    });

    it('should return false for vscode when not installed', () => {
      (execSync as Mock).mockImplementation(() => {
        throw new Error();
      });
      expect(isEditorAvailable('vscode')).toBe(false);
    });
  });
});
