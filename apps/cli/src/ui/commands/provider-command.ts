/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProviderDialog } from '../components/dialogs/provider-dialog.js';
import { CommandKind, type SlashCommand } from './types.js';

export const providerCommand: SlashCommand = {
  name: 'provider',
  description: 'View or update DSH provider credentials',
  inputHint: '[provider]',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: (context, args) => {
    const runtime = context.services.providerSetup;
    if (!runtime) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'DSH provider setup is unavailable.',
      };
    }
    const words = args.trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /provider [provider]',
      };
    }
    return {
      type: 'custom_dialog',
      component: React.createElement(ProviderDialog, {
        runtime,
        initialProvider: words[0],
        onClose: context.ui.removeComponent,
      }),
    };
  },
  completion: async (context, partialArg) => {
    const runtime = context.services.providerSetup;
    if (!runtime) return [];
    const providers = await runtime.listProviders();
    const prefix = partialArg.trimStart().toLocaleLowerCase();
    return providers
      .map((provider) => provider.provider)
      .filter((provider) => provider.toLocaleLowerCase().startsWith(prefix));
  },
};
