/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { ConversationRuntime, ConversationSnapshot, ConversationSubmission } from './conversation-runtime.js';
import { ConversationWorkspaceRuntime, type SideConversationHandle } from './conversation-workspace-runtime.js';

function conversation(sessionId: string) {
  let snapshot: ConversationSnapshot = { messages: [], todos: [], busy: false };
  const listeners = new Set<() => void>();
  const submit = vi.fn(async (_submission: ConversationSubmission) => {});
  const cancel = vi.fn();
  const runtime: ConversationRuntime = {
    getSnapshot: () => snapshot,
    getSessionStats: () => ({
      sessionId,
      metrics: { models: {}, tools: { totalCalls: 0, totalSuccess: 0, totalFail: 0, byName: {} } },
      lastPromptTokenCount: 0,
    }),
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    submit, cancel, exit: vi.fn(),
  };
  return {
    runtime, submit, cancel,
    update(next: ConversationSnapshot) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

function sideConversation() {
  const base = conversation('dsh-console-side-1');
  const dispose = vi.fn(async () => {});
  return {
    ...base,
    handle: {
      ...base.runtime,
      parentSessionId: 'dsh-console-main',
      modelLabel: 'deepseek/model',
      reasoningEffortLabel: 'High',
      dispose,
    } as SideConversationHandle,
    dispose,
  };
}

describe('ConversationWorkspaceRuntime', () => {
  it('opens a child surface and routes multiple turns without stopping Main', async () => {
    const main = conversation('dsh-console-main');
    const side = sideConversation();
    const workspace = new ConversationWorkspaceRuntime(main.runtime, vi.fn(async () => side.handle));
    await workspace.open('first question', new AbortController().signal);
    await workspace.submit({
      content: [{ type: 'text', text: 'follow up' }],
      displayContent: [{ type: 'text', text: 'follow up' }],
      signal: new AbortController().signal,
    });
    expect(workspace.getWorkspaceSnapshot()).toMatchObject({
      activeSurface: 'side', sideSessionId: 'dsh-console-side-1', sideModelLabel: 'deepseek/model',
    });
    expect(side.submit).toHaveBeenCalledTimes(2);
    expect(main.cancel).not.toHaveBeenCalled();
  });

  it('keeps Main running while Side is visible and switches without disposal', async () => {
    const main = conversation('dsh-console-main');
    const side = sideConversation();
    const workspace = new ConversationWorkspaceRuntime(main.runtime, async () => side.handle);
    const listener = vi.fn();
    workspace.subscribeWorkspace(listener);
    await workspace.open('question', new AbortController().signal);
    main.update({ messages: [], todos: [], busy: true });
    expect(workspace.getWorkspaceSnapshot().mainBusy).toBe(true);
    workspace.switchToMain();
    expect(workspace.getSessionStats().sessionId).toBe('dsh-console-main');
    workspace.switchToSide();
    expect(workspace.getSessionStats().sessionId).toBe('dsh-console-side-1');
    expect(side.dispose).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();
  });

  it('keeps external-store snapshots stable until workspace state changes', async () => {
    const main = conversation('dsh-console-main');
    const side = sideConversation();
    const workspace = new ConversationWorkspaceRuntime(
      main.runtime,
      async () => side.handle,
    );
    const initial = workspace.getWorkspaceSnapshot();
    expect(workspace.getWorkspaceSnapshot()).toBe(initial);
    main.update({ messages: [], todos: [], busy: true });
    expect(workspace.getWorkspaceSnapshot()).not.toBe(initial);
    expect(workspace.getWorkspaceSnapshot()).toBe(
      workspace.getWorkspaceSnapshot(),
    );
  });

  it('cancels only the active surface and closes idle Side back to Main', async () => {
    const main = conversation('dsh-console-main');
    const side = sideConversation();
    const workspace = new ConversationWorkspaceRuntime(main.runtime, async () => side.handle);
    await workspace.open('question', new AbortController().signal);
    workspace.cancel();
    expect(side.cancel).toHaveBeenCalledOnce();
    expect(main.cancel).not.toHaveBeenCalled();
    await workspace.closeSide();
    expect(workspace.getWorkspaceSnapshot().activeSurface).toBe('main');
    expect(side.dispose).toHaveBeenCalledOnce();
    expect(side.cancel).toHaveBeenCalledOnce();
  });

  it('rolls back a newly created Side when its first submission fails', async () => {
    const main = conversation('dsh-console-main');
    const side = sideConversation();
    side.submit.mockRejectedValueOnce(new Error('submission failed'));
    const workspace = new ConversationWorkspaceRuntime(
      main.runtime,
      async () => side.handle,
    );
    await expect(
      workspace.open('question', new AbortController().signal),
    ).rejects.toThrow('submission failed');
    expect(workspace.getWorkspaceSnapshot().activeSurface).toBe('main');
    expect(workspace.getWorkspaceSnapshot().sideSessionId).toBeUndefined();
    expect(side.dispose).toHaveBeenCalledOnce();
  });
});
