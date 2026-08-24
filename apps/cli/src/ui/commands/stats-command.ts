/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatDuration } from '../../text/formatting.js';
import { CommandKind, type SlashCommand } from './types.js';

export const statsCommand: SlashCommand = {
  name: 'stats',
  description: 'Show metrics derived from the current DSH session',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (context) => {
    const duration = Date.now() - context.session.stats.sessionStartTime.getTime();
    context.ui.addItem({ type: 'stats', duration: formatDuration(duration) }, Date.now());
  },
};
