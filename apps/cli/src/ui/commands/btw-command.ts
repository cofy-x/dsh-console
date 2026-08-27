/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, type SlashCommand } from './types.js';

export const btwCommand: SlashCommand = {
  name: 'btw',
  description: 'Ask an ephemeral side question without interrupting the main Agent',
  inputHint: '<question>',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  recordInvocation: false,
  allowWhileBusy: true,
  action: async (context, args) => {
    const question = args.trim();
    const runtime = context.services.sideConversation;
    if (!runtime) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'DSH Side conversations are unavailable.',
      };
    }
    if (!question && runtime.getWorkspaceSnapshot().sideSessionId === undefined) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Usage: /btw <question>',
      };
    }
    await runtime.open(question || undefined, context.invocation.signal);
    return undefined;
  },
};

export const mainCommand: SlashCommand = {
  name: 'main',
  description: 'Switch to the main conversation',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  recordInvocation: false,
  allowWhileBusy: true,
  action: (context, args) => {
    if (args.trim()) return { type: 'message', messageType: 'error', content: 'Usage: /main' };
    const runtime = context.services.sideConversation;
    if (!runtime) return { type: 'message', messageType: 'error', content: 'DSH Side conversations are unavailable.' };
    runtime.switchToMain();
    return undefined;
  },
};

export const sideCommand: SlashCommand = {
  name: 'side',
  description: 'Switch to the active Side conversation',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  recordInvocation: false,
  allowWhileBusy: true,
  action: (context, args) => {
    if (args.trim()) return { type: 'message', messageType: 'error', content: 'Usage: /side' };
    const runtime = context.services.sideConversation;
    if (!runtime) return { type: 'message', messageType: 'error', content: 'DSH Side conversations are unavailable.' };
    runtime.switchToSide();
    return undefined;
  },
};
