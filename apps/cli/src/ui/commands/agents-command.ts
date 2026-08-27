/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AgentsDialog } from '../components/dialogs/agents-dialog.js';
import { CommandKind, type SlashCommand } from './types.js';

export const agentsCommand: SlashCommand = {
  name: 'agents',
  description: 'Inspect subagents delegated by the Main Agent',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  recordInvocation: false,
  allowWhileBusy: true,
  action: (context, args) => {
    if (args.trim().length > 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /agents',
      };
    }
    const runtime = context.services.subagentCatalog;
    if (!runtime) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'DSH Agent catalog is unavailable.',
      };
    }
    return {
      type: 'custom_dialog',
      component: React.createElement(AgentsDialog, {
        runtime,
        onClose: context.ui.removeComponent,
      }),
    };
  },
};
