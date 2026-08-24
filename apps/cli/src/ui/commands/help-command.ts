/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import type { HistoryItemHelp } from '../types.js';

export const helpCommand: SlashCommand = {
  name: 'help',
  altNames: ['?'],
  kind: CommandKind.BUILT_IN,
  description: 'Show DSH Console commands',
  autoExecute: true,
  action: async (context) => {
    const helpItem: Omit<HistoryItemHelp, 'id'> = {
      type: 'help',
      timestamp: new Date(),
    };

    context.ui.addItem(helpItem);
  },
};
