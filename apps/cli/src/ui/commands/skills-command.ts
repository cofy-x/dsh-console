/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SkillsDialog } from '../components/dialogs/skills-dialog.js';
import { CommandKind, type SlashCommand } from './types.js';

export const skillsCommand: SlashCommand = {
  name: 'skills',
  description: 'Inspect Skills visible to the current DSH Agent',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args) => {
    if (args.trim().length > 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /skills',
      };
    }
    const runtime = context.services.skillCatalog;
    if (runtime === undefined) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'DSH Skill catalog is unavailable.',
      };
    }
    await runtime.prepare(context.invocation.signal);
    return {
      type: 'custom_dialog',
      component: React.createElement(SkillsDialog, {
        runtime,
        onClose: context.ui.removeComponent,
      }),
    };
  },
};
