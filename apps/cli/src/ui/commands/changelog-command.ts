/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { loadChangelog } from '../../services/changelog-loader.js';
import { ChangelogDialog } from '../components/dialogs/changelog-dialog.js';
import { CommandKind, type SlashCommand } from './types.js';

type ChangelogLoader = () => Promise<string>;

export function createChangelogCommand(
  loader: ChangelogLoader = loadChangelog,
): SlashCommand {
  return {
    name: 'changelog',
    description: 'Show DSH Console release notes',
    kind: CommandKind.BUILT_IN,
    autoExecute: true,
    recordInvocation: false,
    action: async (context, args) => {
      if (args.trim().length > 0) {
        return {
          type: 'message',
          messageType: 'error',
          content: 'Usage: /changelog',
        };
      }

      try {
        const content = await loader();
        return {
          type: 'custom_dialog',
          component: React.createElement(ChangelogDialog, {
            content,
            onClose: context.ui.removeComponent,
          }),
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return {
          type: 'message',
          messageType: 'error',
          content: `Could not load the changelog: ${detail}`,
        };
      }
    },
  };
}

export const changelogCommand = createChangelogCommand();
