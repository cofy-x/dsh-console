/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { AgentPresetOptionView } from '../agent-preset-runtime.js';
import { AgentPresetDialog } from '../components/dialogs/agent-preset-dialog.js';
import { MessageType } from '../types.js';
import { CommandKind, type SlashCommand } from './types.js';

const switchedMessage = (name: string, id: string): string =>
  `Agent preset changed to ${name} (${id}).`;

const completionDescription = (
  option: AgentPresetOptionView,
  currentId: string | undefined,
): string | undefined => {
  const status = [
    ...(option.id === currentId ? ['Current'] : []),
    ...(option.isDefault ? ['Default'] : []),
  ].join(', ');
  const details = [
    ...(option.name === option.id ? [] : [option.name]),
    ...(status === '' ? [] : [status]),
    ...(option.description === undefined ? [] : [option.description]),
  ];
  return details.length === 0 ? undefined : details.join(' | ');
};

export const presetCommand: SlashCommand = {
  name: 'preset',
  description: 'Show or change the current DSH Agent preset',
  inputHint: '[preset]',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args) => {
    if (
      context.services.sideConversation?.getWorkspaceSnapshot()
        .sideSessionId !== undefined
    ) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'Close the Side conversation before changing the Main Agent preset. Use /side, then Ctrl+C.',
      };
    }
    const runtime = context.services.agentPreset;
    if (runtime === undefined) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'DSH Agent presets are unavailable.',
      };
    }
    await runtime.prepare(context.invocation.signal);
    const value = args.trim();
    if (value === '') {
      return {
        type: 'custom_dialog',
        component: React.createElement(AgentPresetDialog, {
          runtime,
          onClose: context.ui.removeComponent,
          onSwitched: (selection) => {
            context.ui.addItem({
              type: MessageType.INFO,
              text: switchedMessage(selection.name, selection.id),
            });
            context.ui.removeComponent();
          },
        }),
      };
    }
    if (/\s/.test(value)) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /preset [preset]',
      };
    }
    const option = await runtime.select(value, context.invocation.signal);
    return {
      type: 'message',
      messageType: 'info',
      content: switchedMessage(option.name, option.id),
    };
  },
  completion: async (context, partialArg) => {
    const runtime = context.services.agentPreset;
    if (runtime === undefined) return [];
    await runtime.prepare();
    const prefix = partialArg.trimStart();
    const snapshot = runtime.getSnapshot();
    return snapshot.options
      .filter(
        (option) => option.broken === undefined && option.id.startsWith(prefix),
      )
      .map((option) => {
        const description = completionDescription(option, snapshot.currentId);
        return {
          value: option.id,
          ...(description === undefined ? {} : { description }),
        };
      });
  },
};
