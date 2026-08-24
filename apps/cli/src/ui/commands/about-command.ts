/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { arch, platform, release } from 'node:os';
import { getVersion } from '../../utils/version.js';
import { modelSelectionLabel } from '../model-selection-runtime.js';
import type { HistoryItemAbout } from '../types.js';
import { CommandKind, type SlashCommand } from './types.js';

export const aboutCommand: SlashCommand = {
  name: 'about',
  description: 'Show DSH Console runtime information',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context) => {
    const currentModel = context.services.modelSelection?.getSnapshot().current;
    const item: Omit<HistoryItemAbout, 'id'> = {
      type: 'about',
      cliVersion: await getVersion(),
      osVersion: `${platform()} ${release()} (${arch()})`,
      modelVersion: currentModel
        ? modelSelectionLabel(currentModel)
        : 'Unavailable',
    };
    context.ui.addItem(item);
  },
};
