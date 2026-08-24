/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PermissionDialog } from '../components/dialogs/permission-dialog.js';
import type { PermissionOptionView } from '../permission-selection-runtime.js';
import { MessageType } from '../types.js';
import { CommandKind, type SlashCommand } from './types.js';

function switchedMessage(option: PermissionOptionView): string {
  return `Permission preset changed to ${option.name} (${option.value}).`;
}

export const permissionCommand: SlashCommand = {
  name: 'permission',
  description: 'Show or change the current DSH permission preset',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args) => {
    const runtime = context.services.permissionSelection;
    if (!runtime || !runtime.getSnapshot().available) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'DSH permission presets are unavailable.',
      };
    }
    const value = args.trim();
    if (value === '') {
      return {
        type: 'custom_dialog',
        component: React.createElement(PermissionDialog, {
          runtime,
          onClose: context.ui.removeComponent,
          onSwitched: (selection) => {
            context.ui.addItem({ type: MessageType.INFO, text: switchedMessage(selection) });
            context.ui.removeComponent();
          },
        }),
      };
    }
    if (/\s/.test(value)) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /permission [preset]',
      };
    }
    const current = runtime.getSnapshot();
    const option = current.options.find((candidate) => candidate.value === value);
    if (!option) {
      return {
        type: 'message',
        messageType: 'error',
        content: `Unknown permission preset: ${value}`,
      };
    }
    if (current.currentValue === value) {
      return {
        type: 'message',
        messageType: 'info',
        content: `Already using permission preset ${option.name} (${option.value}).`,
      };
    }
    if (option.requiresConfirmation && context.overwriteConfirmed !== true) {
      return {
        type: 'confirm_action',
        prompt: `Permission preset ${option.name} (${option.value}) enables Full access. Continue?`,
        originalInvocation: {
          raw: context.invocation.raw,
        },
      };
    }
    const activated = await runtime.setPermission(value, context.invocation.signal);
    return { type: 'message', messageType: 'info', content: switchedMessage(activated) };
  },
  completion: (context, partialArg) => {
    const prefix = partialArg.trimStart();
    return (
      context.services.permissionSelection?.getSnapshot().options
        .map((option) => option.value)
        .filter((value) => value.startsWith(prefix)) ?? []
    );
  },
  showCompletionLoading: false,
};
