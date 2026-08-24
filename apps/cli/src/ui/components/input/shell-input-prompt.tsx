/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import type React from 'react';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { ShellExecutionService } from '@cofy-x/dsh-console-core';
import { keyToAnsi, type Key } from '../../../terminal/keys.js';

export interface ShellInputPromptProps {
  activeShellPtyId: number | null;
  focus?: boolean;
}

export const ShellInputPrompt: React.FC<ShellInputPromptProps> = ({
  activeShellPtyId,
  focus = true,
}) => {
  const handleShellInputSubmit = useCallback(
    (input: string) => {
      if (activeShellPtyId) {
        ShellExecutionService.writeToPty(activeShellPtyId, input);
      }
    },
    [activeShellPtyId],
  );

  const handleInput = useCallback(
    (key: Key) => {
      if (!focus || !activeShellPtyId) {
        return;
      }
      if (key.ctrl && key.shift && key.name === 'up') {
        ShellExecutionService.scrollPty(activeShellPtyId, -1);
        return;
      }

      if (key.ctrl && key.shift && key.name === 'down') {
        ShellExecutionService.scrollPty(activeShellPtyId, 1);
        return;
      }

      const ansiSequence = keyToAnsi(key);
      if (ansiSequence) {
        handleShellInputSubmit(ansiSequence);
      }
    },
    [focus, handleShellInputSubmit, activeShellPtyId],
  );

  useKeypress(handleInput, { isActive: focus });

  return null;
};
