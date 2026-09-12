/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CommandKind, type SlashCommand } from './types.js';
import { JobsDialog } from '../components/dialogs/jobs-dialog.js';
import { GoalDialog } from '../components/dialogs/goal-dialog.js';

function activityCommand(name: 'jobs' | 'goals'): SlashCommand {
  return {
    name,
    description:
      name === 'jobs'
        ? 'Inspect and stop background jobs for this Session'
        : 'Inspect and manage the current Session goal',
    kind: CommandKind.BUILT_IN,
    autoExecute: true,
    action: (context, args) => {
      if (args.trim())
        return {
          type: 'message',
          messageType: 'error',
          content: `Usage: /${name}`,
        };
      const runtime = context.services.agentActivity;
      if (!runtime)
        return {
          type: 'message',
          messageType: 'error',
          content: 'DSH Agent activity is unavailable.',
        };
      return {
        type: 'custom_dialog',
        component: React.createElement(
          name === 'jobs' ? JobsDialog : GoalDialog,
          { runtime, onClose: context.ui.removeComponent },
        ),
      };
    },
  };
}

export const jobsCommand = activityCommand('jobs');
export const goalsCommand = activityCommand('goals');
