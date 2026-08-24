/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToolsDialog } from '../components/dialogs/tools-dialog.js';
import { CommandKind, type SlashCommand } from './types.js';

export const toolsCommand: SlashCommand = {
  name: 'tools',
  description: 'Inspect tools visible to the current DSH Agent',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (context, args) => {
    if (args.trim().length > 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /tools',
      };
    }
    const runtime = context.services.toolCatalog;
    if (!runtime) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'DSH tool catalog is unavailable.',
      };
    }
    return {
      type: 'custom_dialog',
      component: React.createElement(ToolsDialog, {
        runtime,
        onClose: context.ui.removeComponent,
      }),
    };
  },
};
