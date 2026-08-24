/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';

const GUI_EDITORS = [
  'vscode',
  'vscodium',
  'windsurf',
  'cursor',
  'zed',
  'antigravity',
] as const;
const TERMINAL_EDITORS = ['vim', 'neovim', 'emacs', 'hx'] as const;
const EDITORS = [...GUI_EDITORS, ...TERMINAL_EDITORS] as const;

const GUI_EDITORS_SET = new Set<string>(GUI_EDITORS);
const EDITORS_SET = new Set<string>(EDITORS);

type GuiEditorType = (typeof GUI_EDITORS)[number];
export type EditorType = (typeof EDITORS)[number];

export function isGuiEditor(editor: EditorType): editor is GuiEditorType {
  return GUI_EDITORS_SET.has(editor);
}

export const EDITOR_DISPLAY_NAMES: Record<EditorType, string> = {
  vscode: 'VS Code',
  vscodium: 'VSCodium',
  windsurf: 'Windsurf',
  cursor: 'Cursor',
  vim: 'Vim',
  neovim: 'Neovim',
  zed: 'Zed',
  emacs: 'Emacs',
  antigravity: 'Antigravity',
  hx: 'Helix',
};

export function getEditorDisplayName(editor: EditorType): string {
  return EDITOR_DISPLAY_NAMES[editor] || editor;
}

function isValidEditorType(editor: string): editor is EditorType {
  return EDITORS_SET.has(editor);
}

function commandExists(cmd: string): boolean {
  try {
    execSync(
      process.platform === 'win32' ? `where.exe ${cmd}` : `command -v ${cmd}`,
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Editor command configurations for different platforms.
 * Each editor can have multiple possible command names, listed in order of preference.
 */
const editorCommands: Record<
  EditorType,
  { win32: string[]; default: string[] }
> = {
  vscode: { win32: ['code.cmd'], default: ['code'] },
  vscodium: { win32: ['codium.cmd'], default: ['codium'] },
  windsurf: { win32: ['windsurf'], default: ['windsurf'] },
  cursor: { win32: ['cursor'], default: ['cursor'] },
  vim: { win32: ['vim'], default: ['vim'] },
  neovim: { win32: ['nvim'], default: ['nvim'] },
  zed: { win32: ['zed'], default: ['zed', 'zeditor'] },
  emacs: { win32: ['emacs.exe'], default: ['emacs'] },
  antigravity: {
    win32: ['agy.cmd', 'antigravity.cmd', 'antigravity'],
    default: ['agy', 'antigravity'],
  },
  hx: { win32: ['hx'], default: ['hx'] },
};

export function checkHasEditorType(editor: EditorType): boolean {
  const commandConfig = editorCommands[editor];
  const commands =
    process.platform === 'win32' ? commandConfig.win32 : commandConfig.default;
  return commands.some((cmd) => commandExists(cmd));
}

export function getEditorCommand(editor: EditorType): string {
  const commandConfig = editorCommands[editor];
  const commands =
    process.platform === 'win32' ? commandConfig.win32 : commandConfig.default;
  return (
    commands.slice(0, -1).find((cmd) => commandExists(cmd)) ||
    commands[commands.length - 1]
  );
}

/**
 * Check if the editor is valid and can be used.
 * Returns false if preferred editor is not set, invalid, or unavailable.
 */
export function isEditorAvailable(editor: string | undefined): boolean {
  if (editor && isValidEditorType(editor)) {
    return checkHasEditorType(editor);
  }
  return false;
}
