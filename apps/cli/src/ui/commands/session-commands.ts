/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CommandKind, type CommandContext, type SlashCommand } from './types.js';
import { SessionDialog } from '../components/dialogs/session-dialog.js';

function unavailable() {
  return { type: 'message' as const, messageType: 'error' as const, content: 'DSH Session management is unavailable.' };
}

function openDialog(context: CommandContext) {
  const runtime = context.services.sessionManagement;
  if (!runtime) return unavailable();
  return {
    type: 'custom_dialog' as const,
    component: React.createElement(SessionDialog, {
      runtime,
      onClose: context.ui.removeComponent,
    }),
  };
}

export const newCommand: SlashCommand = {
  name: 'new',
  description: 'Start a fresh DSH Session',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args) => {
    if (args.trim() !== '') return { type: 'message', messageType: 'error', content: 'Usage: /new' };
    const runtime = context.services.sessionManagement;
    if (!runtime) return unavailable();
    if (runtime.isBusy()) return { type: 'message', messageType: 'error', content: 'Cannot start a new Session while the Agent is working.' };
    if (!runtime.hasConversation()) return { type: 'message', messageType: 'info', content: 'The current Session is already empty.' };
    if (context.overwriteConfirmed !== true) {
      return {
        type: 'confirm_action',
        prompt: 'Start a new Session and replace the current transcript?',
        originalInvocation: { raw: context.invocation?.raw ?? '/new' },
      };
    }
    await runtime.createNew();
    return undefined;
  },
};

export const sessionsCommand: SlashCommand = {
  name: 'sessions',
  description: 'Browse dsh-console Sessions in this workspace',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args) => args.trim() === ''
    ? openDialog(context)
    : { type: 'message', messageType: 'error', content: 'Usage: /sessions' },
};

export const resumeCommand: SlashCommand = {
  name: 'resume',
  description: 'Resume a persisted dsh-console Session',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context, args) => {
    const runtime = context.services.sessionManagement;
    if (!runtime) return unavailable();
    const sessionId = args.trim();
    if (sessionId === '') return openDialog(context);
    if (/\s/.test(sessionId)) return { type: 'message', messageType: 'error', content: 'Usage: /resume <full-session-id>' };
    if (sessionId === runtime.getSnapshot().currentSessionId) {
      return { type: 'message', messageType: 'info', content: 'That Session is already active.' };
    }
    if (runtime.isBusy()) return { type: 'message', messageType: 'error', content: 'Cannot resume a Session while the Agent is working.' };
    if (runtime.hasConversation() && context.overwriteConfirmed !== true) {
      return {
        type: 'confirm_action',
        prompt: 'Resume this Session and replace the current transcript?',
        originalInvocation: { raw: context.invocation?.raw ?? `/resume ${sessionId}` },
      };
    }
    await runtime.resumeSession(sessionId);
    return undefined;
  },
};
