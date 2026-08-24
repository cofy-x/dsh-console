/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeToStdout } from '@cofy-x/dsh-console-core';
import type { LoadedSettings } from '../config/user-settings.js';
import { StreamingState } from '../ui/types.js';

export function setWindowTitle(title: string, settings: LoadedSettings) {
  if (!settings.merged.ui.hideWindowTitle) {
    // Initial state before React loop starts
    const windowTitle = computeTerminalTitle({
      streamingState: StreamingState.Idle,
      isConfirming: false,
      isSilentWorking: false,
      folderName: title,
      useDynamicTitle: settings.merged.ui.dynamicWindowTitle,
    });
    writeToStdout(`\x1b]0;${windowTitle}\x07`);

    process.on('exit', () => {
      writeToStdout(`\x1b]0;\x07`);
    });
  }
}

export interface TerminalTitleOptions {
  streamingState: StreamingState;
  isConfirming: boolean;
  isSilentWorking: boolean;
  folderName: string;
  useDynamicTitle: boolean;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return text.substring(0, maxLen - 1) + '…';
}

/**
 * Computes the dynamic terminal window title based on the current CLI state.
 *
 * @param options - The current state of the CLI and environment context
 * @returns A formatted string padded to 80 characters for the terminal title
 */
export function computeTerminalTitle({
  streamingState,
  isConfirming,
  isSilentWorking,
  folderName,
  useDynamicTitle,
}: TerminalTitleOptions): string {
  const MAX_LEN = 80;

  // Use CLI_TITLE env var if available, otherwise use the provided folder name
  let displayContext = process.env['CLI_TITLE'] || folderName;

  if (!useDynamicTitle) {
    const base = 'DSH Console ';
    // Max context length is 80 - base.length - 2 (for brackets)
    const maxContextLen = MAX_LEN - base.length - 2;
    displayContext = truncate(displayContext, maxContextLen);
    return `${base}(${displayContext})`.padEnd(MAX_LEN, ' ');
  }

  // Pre-calculate suffix but keep it flexible
  const getSuffix = (context: string) => ` (${context})`;

  let title;
  if (isConfirming) {
    const base = '✋  Action Required';
    // Max context length is 80 - base.length - 3 (for ' (' and ')')
    const maxContextLen = MAX_LEN - base.length - 3;
    const context = truncate(displayContext, maxContextLen);
    title = `${base}${getSuffix(context)}`;
  } else if (isSilentWorking) {
    const base = '⏲  Working…';
    // Max context length is 80 - base.length - 3 (for ' (' and ')')
    const maxContextLen = MAX_LEN - base.length - 3;
    const context = truncate(displayContext, maxContextLen);
    title = `${base}${getSuffix(context)}`;
  } else if (streamingState === StreamingState.Idle) {
    const base = '◇  Ready';
    // Max context length is 80 - base.length - 3 (for ' (' and ')')
    const maxContextLen = MAX_LEN - base.length - 3;
    const context = truncate(displayContext, maxContextLen);
    title = `${base}${getSuffix(context)}`;
  } else {
    const base = '✦  Working…';
    const maxContextLen = MAX_LEN - base.length - 3;
    const context = truncate(displayContext, maxContextLen);
    title = `${base}${getSuffix(context)}`;
  }

  // Remove control characters that could cause issues in terminal titles
  // eslint-disable-next-line no-control-regex
  const safeTitle = title.replace(/[\x00-\x1F\x7F]/g, '');

  // Pad the title to a fixed width to prevent taskbar icon resizing/jitter.
  // We also slice it to ensure it NEVER exceeds MAX_LEN.
  return safeTitle.padEnd(MAX_LEN, ' ').substring(0, MAX_LEN);
}
