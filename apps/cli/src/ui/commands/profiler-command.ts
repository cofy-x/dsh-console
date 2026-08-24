/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, type SlashCommand } from './types.js';

export const profilerCommand: SlashCommand = {
  name: 'profiler',
  description: 'Toggle React/Ink render diagnostics',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (context) => context.ui.toggleDebugProfiler(),
};
