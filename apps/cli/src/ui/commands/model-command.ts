/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CommandKind, type SlashCommand } from './types.js';
import { modelSelectionLabel } from '../model-selection-runtime.js';
import { ModelDialog } from '../components/dialogs/model-dialog.js';
import { MessageType } from '../types.js';

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Open the DSH model selector',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (context, args) => {
    if (args.trim()) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /model',
      };
    }
    if (
      context.services.sideConversation?.getWorkspaceSnapshot()
        .sideSessionId !== undefined
    ) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'Close the Side conversation before changing the Main model. Use /side, then Ctrl+C.',
      };
    }
    const runtime = context.services.modelSelection;
    if (!runtime) {
      return { type: 'message', messageType: 'error', content: 'DSH model selection is unavailable.' };
    }
    return {
      type: 'custom_dialog',
      component: React.createElement(ModelDialog, {
        runtime,
        providerSetupRuntime: context.services.providerSetup,
        onClose: context.ui.removeComponent,
        onSwitched: (selection) => {
          context.ui.addItem({
            type: MessageType.INFO,
            text: `Started a new Agent with ${modelSelectionLabel(selection)}.`,
          });
          context.ui.removeComponent();
        },
      }),
    };
  },
};
