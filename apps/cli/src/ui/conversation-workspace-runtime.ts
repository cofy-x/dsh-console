/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ConversationRuntime,
  ConversationSubmission,
} from './conversation-runtime.js';

export type ConversationSurface = 'main' | 'side';

export interface SideConversationHandle extends ConversationRuntime {
  readonly parentSessionId: string;
  readonly modelLabel: string;
  readonly reasoningEffortLabel?: string;
  dispose(): Promise<void>;
}

export interface ConversationWorkspaceSnapshot {
  activeSurface: ConversationSurface;
  mainBusy: boolean;
  sideBusy: boolean;
  sideSessionId?: string;
  sideModelLabel?: string;
  sideReasoningEffortLabel?: string;
}

export interface SideConversationRuntime {
  getWorkspaceSnapshot(): ConversationWorkspaceSnapshot;
  subscribeWorkspace(listener: () => void): () => void;
  open(question: string | undefined, signal: AbortSignal): Promise<void>;
  switchToMain(): void;
  switchToSide(): void;
  closeSide(): Promise<void>;
}

export type SideConversationFactory = (
  signal: AbortSignal,
) => Promise<SideConversationHandle>;

/** Routes one stable UI runtime across a main conversation and one child side conversation. */
export class ConversationWorkspaceRuntime
  implements ConversationRuntime, SideConversationRuntime
{
  private readonly listeners = new Set<() => void>();
  private readonly surfaceListeners = new Set<() => void>();
  private readonly offMain: () => void;
  private side: SideConversationHandle | undefined;
  private offSide: (() => void) | undefined;
  private activeSurface: ConversationSurface = 'main';
  private opening: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private workspaceSnapshot: ConversationWorkspaceSnapshot;

  constructor(
    private readonly main: ConversationRuntime,
    private readonly createSide: SideConversationFactory,
  ) {
    this.offMain = main.subscribe(this.notify);
    this.workspaceSnapshot = this.createWorkspaceSnapshot();
  }

  getSnapshot = () => this.current().getSnapshot();

  getSessionStats = () => this.current().getSessionStats();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  submit = (submission: ConversationSubmission): Promise<void> =>
    this.current().submit(submission);

  cancel = (): void => this.current().cancel();

  exit = (): void => this.main.exit();

  getWorkspaceSnapshot = (): ConversationWorkspaceSnapshot =>
    this.workspaceSnapshot;

  subscribeWorkspace = this.subscribe;

  subscribeSurface = (listener: () => void): (() => void) => {
    this.surfaceListeners.add(listener);
    return () => this.surfaceListeners.delete(listener);
  };

  open = async (
    question: string | undefined,
    signal: AbortSignal,
  ): Promise<void> => {
    const normalized = question?.trim();
    let createdSide = false;
    if (this.closing) await this.closing;
    if (this.opening) throw new Error('A Side conversation is already opening.');
    if (this.side?.getSnapshot().busy && normalized) {
      this.switchToSide();
      throw new Error('The Side Agent is already working.');
    }

    if (!this.side) {
      const operation = this.createSide(signal).then(async (side) => {
        if (signal.aborted) {
          await side.dispose();
          signal.throwIfAborted();
        }
        this.side = side;
        createdSide = true;
        this.offSide = side.subscribe(this.notify);
        this.activeSurface = 'side';
        this.notifySurface();
      });
      this.opening = operation;
      try {
        await operation;
      } finally {
        if (this.opening === operation) this.opening = undefined;
      }
    } else {
      this.switchToSide();
    }

    if (normalized) {
      try {
        await this.side?.submit({
          content: [{ type: 'text', text: normalized }],
          displayContent: [{ type: 'text', text: normalized }],
          signal,
        });
      } catch (error) {
        if (createdSide) await this.closeSide();
        throw error;
      }
    }
  };

  switchToMain = (): void => {
    if (this.activeSurface === 'main') return;
    this.activeSurface = 'main';
    this.notifySurface();
  };

  switchToSide = (): void => {
    if (!this.side) throw new Error('No Side conversation is open. Use /btw <question> first.');
    if (this.activeSurface === 'side') return;
    this.activeSurface = 'side';
    this.notifySurface();
  };

  closeSide = async (): Promise<void> => {
    if (this.closing) return this.closing;
    const side = this.side;
    if (!side) return;
    this.activeSurface = 'main';
    this.side = undefined;
    this.offSide?.();
    this.offSide = undefined;
    this.notifySurface();
    const operation = side.dispose().finally(() => {
      if (this.closing === operation) this.closing = undefined;
    });
    this.closing = operation;
    await operation;
  };

  dispose = async (): Promise<void> => {
    await this.closeSide();
    this.offMain();
    this.listeners.clear();
    this.surfaceListeners.clear();
  };

  private current(): ConversationRuntime {
    return this.activeSurface === 'side' && this.side ? this.side : this.main;
  }

  private createWorkspaceSnapshot(): ConversationWorkspaceSnapshot {
    return {
      activeSurface: this.activeSurface,
      mainBusy: this.main.getSnapshot().busy,
      sideBusy: this.side?.getSnapshot().busy ?? false,
      ...(this.side === undefined
        ? {}
        : {
            sideSessionId: this.side.getSessionStats().sessionId,
            sideModelLabel: this.side.modelLabel,
            ...(this.side.reasoningEffortLabel === undefined
              ? {}
              : {
                  sideReasoningEffortLabel: this.side.reasoningEffortLabel,
                }),
          }),
    };
  }

  private notify = (): void => {
    this.workspaceSnapshot = this.createWorkspaceSnapshot();
    for (const listener of this.listeners) listener();
  };

  private notifySurface = (): void => {
    this.notify();
    for (const listener of this.surfaceListeners) listener();
  };
}
