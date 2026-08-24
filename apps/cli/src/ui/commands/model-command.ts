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

function modalities(values: readonly string[]): string {
  return values.join(', ');
}

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Show or configure the DSH model route',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args) => {
    const runtime = context.services.modelSelection;
    if (!runtime) {
      return { type: 'message', messageType: 'error', content: 'DSH model selection is unavailable.' };
    }
    const words = args.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return {
        type: 'custom_dialog',
        component: React.createElement(ModelDialog, {
          runtime,
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
    }
    if (words[0] === 'list' && words.length === 1) {
      const models = await runtime.listModels();
      return {
        type: 'message',
        messageType: 'info',
        content: models
          .map((model) => `${modelSelectionLabel(model)} [${modalities(model.inputModalities)}]`)
          .join('\n'),
      };
    }
    if (words[0] === 'set' && words.length === 3) {
      const current = runtime.getSnapshot().current;
      if (current.provider === words[1] && current.model === words[2]) {
        return {
          type: 'message',
          messageType: 'info',
          content: `Already using ${modelSelectionLabel(current)}.`,
        };
      }
      if (runtime.hasConversation() && context.overwriteConfirmed !== true) {
        return {
          type: 'confirm_action',
          prompt: 'Changing model starts a new Agent and Session. Continue?',
          originalInvocation: { raw: context.invocation?.raw ?? `/model ${args}` },
        };
      }
      const selected = await runtime.setModel(words[1], words[2]);
      return {
        type: 'message',
        messageType: 'info',
        content: `Started a new Agent with ${modelSelectionLabel(selected)}.`,
      };
    }
    return {
      type: 'message',
      messageType: 'error',
      content: 'Usage: /model | /model list | /model set <provider> <model>',
    };
  },
  completion: async (context, partialArg) => {
    const runtime = context.services.modelSelection;
    if (!runtime) return [];
    const prefix = partialArg.trimStart();
    if (!prefix.startsWith('set')) return ['list', 'set '];
    const models = await runtime.listModels();
    return models
      .map((model) => `set ${model.provider} ${model.model}`)
      .filter((candidate) => candidate.startsWith(prefix));
  },
};
