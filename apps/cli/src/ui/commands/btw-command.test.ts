/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { SideConversationRuntime } from '../conversation-workspace-runtime.js';
import type { CommandActionContext } from './types.js';
import { btwCommand, mainCommand, sideCommand } from './btw-command.js';

function runtime(): SideConversationRuntime {
  return {
    getWorkspaceSnapshot: vi.fn(() => ({
      activeSurface: 'main' as const,
      mainBusy: false,
      sideBusy: false,
    })),
    subscribeWorkspace: vi.fn(() => () => {}),
    open: vi.fn(async () => {}),
    switchToMain: vi.fn(),
    switchToSide: vi.fn(),
    closeSide: vi.fn(async () => {}),
  };
}

function context(
  sideConversation?: SideConversationRuntime,
): CommandActionContext {
  return {
    services: { sideConversation },
    ui: {
      addItem: vi.fn(),
      clear: vi.fn(),
      loadHistory: vi.fn(),
      toggleDebugProfiler: vi.fn(),
      toggleVimEnabled: vi.fn(async () => false),
      removeComponent: vi.fn(),
    },
    session: { stats: {} as CommandActionContext['session']['stats'] },
    invocation: {
      raw: '/btw why?',
      name: 'btw',
      args: 'why?',
      signal: new AbortController().signal,
    },
  };
}

describe('Side conversation commands', () => {
  it('opens Side without recording the invocation', async () => {
    const side = runtime();
    await btwCommand.action?.(context(side), ' why now? ');
    expect(btwCommand.recordInvocation).toBe(false);
    expect(btwCommand.allowWhileBusy).toBe(true);
    expect(side.open).toHaveBeenCalledWith('why now?', expect.any(AbortSignal));
  });

  it('uses /btw without arguments to reopen an existing Side', async () => {
    const side = runtime();
    vi.mocked(side.getWorkspaceSnapshot).mockReturnValue({
      activeSurface: 'main',
      mainBusy: true,
      sideBusy: false,
      sideSessionId: 'dsh-console-side-1',
    });
    await btwCommand.action?.(context(side), '');
    expect(side.open).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
  });

  it('requires a first question and an available runtime', async () => {
    const side = runtime();
    await expect(btwCommand.action?.(context(side), '')).resolves.toMatchObject(
      {
        type: 'message',
        content: 'Usage: /btw <question>',
      },
    );
    await expect(btwCommand.action?.(context(), 'why?')).resolves.toMatchObject(
      {
        type: 'message',
        content: 'DSH Side conversations are unavailable.',
      },
    );
  });

  it('switches between Main and Side', async () => {
    const side = runtime();
    await mainCommand.action?.(context(side), '');
    await sideCommand.action?.(context(side), '');
    expect(side.switchToMain).toHaveBeenCalledOnce();
    expect(side.switchToSide).toHaveBeenCalledOnce();
  });
});
