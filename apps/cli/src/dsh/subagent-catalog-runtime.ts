/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { SessionId } from '@deepseek-ai/dsh-session';
import type {
  SubagentDescendantListEntry,
  SubagentRuntime,
} from '@deepseek-ai/dsh-subagent';
import { debugLogger } from '@cofy-x/dsh-console-core';
import type {
  SubagentCatalogItemView,
  SubagentCatalogRuntime,
  SubagentCatalogSnapshot,
} from '../ui/subagent-catalog-runtime.js';
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query';
import type { DshToolPresenter } from './projector.js';
import { DshSubagentTranscriptRuntime } from './subagent-transcript-runtime.js';
import type { SubagentTranscriptRuntime } from '../ui/subagent-transcript-runtime.js';

type CatalogChangeSubscriber = (listener: () => void) => () => void;
type SessionEventSubscriber = Parameters<
  typeof DshSubagentTranscriptRuntime.create
>[3];

function fallbackLabel(id: SessionId): string {
  return `Agent ${String(id).slice(-8)}`;
}

function projectEntry(entry: SubagentDescendantListEntry): SubagentCatalogItemView {
  if (entry.kind === 'diagnostic') {
    return Object.freeze({
      kind: 'diagnostic',
      id: String(entry.id),
      parentId: String(entry.parentId),
      depth: entry.depth,
      reason: entry.reason,
    });
  }
  return Object.freeze({
    kind: 'agent',
    id: String(entry.id),
    parentId: String(entry.parentId),
    depth: entry.depth,
    label: entry.label?.trim() || fallbackLabel(entry.id),
    mode: entry.mode,
    activity: entry.activity,
    hasChildren: entry.hasChildren,
  });
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true ||
    (error instanceof Error && error.name === 'AbortError');
}

export class DshSubagentCatalogRuntime implements SubagentCatalogRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: SubagentCatalogSnapshot;
  private readonly off: () => void;
  private generation = 0;
  private refreshQueued = false;
  private disposed = false;
  private refreshController: AbortController | undefined;

  constructor(
    private readonly subagents: Pick<SubagentRuntime, 'listDescendants'>,
    private readonly rootSessionId: () => SessionId | undefined,
    subscribeToChanges: CatalogChangeSubscriber,
    private readonly query: Pick<SessionQueryEngine, 'readSession'>,
    private readonly presenter: DshToolPresenter,
    private readonly subscribeToSession: SessionEventSubscriber,
  ) {
    this.snapshot = Object.freeze({
      rootSessionId: String(rootSessionId() ?? ''),
      status: 'idle',
      items: Object.freeze([]),
      runningCount: 0,
    });
    this.off = subscribeToChanges(() => this.queueRefresh());
    this.queueRefresh();
  }

  getSnapshot = (): SubagentCatalogSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async openTranscript(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<SubagentTranscriptRuntime> {
    const item = this.snapshot.items.find(
      (candidate) => candidate.id === sessionId && candidate.kind === 'agent',
    );
    if (item === undefined) {
      throw new Error('The selected subagent is no longer available.');
    }
    return DshSubagentTranscriptRuntime.create(
      this.query,
      SessionId(sessionId),
      this.presenter,
      this.subscribeToSession,
      signal,
    );
  }

  async refresh(signal?: AbortSignal): Promise<void> {
    if (this.disposed || signal?.aborted) return;
    this.refreshController?.abort();
    const controller = new AbortController();
    this.refreshController = controller;
    const refreshSignal = signal === undefined
      ? controller.signal
      : AbortSignal.any([signal, controller.signal]);
    const generation = ++this.generation;
    const rootSessionId = this.rootSessionId();
    if (rootSessionId === undefined) {
      this.publish({
        rootSessionId: '',
        status: 'idle',
        items: Object.freeze([]),
        runningCount: 0,
      });
      return;
    }
    this.publish({
      ...this.snapshot,
      rootSessionId: String(rootSessionId),
      status: 'loading',
      error: undefined,
    });
    try {
      const entries = await this.subagents.listDescendants(rootSessionId, refreshSignal);
      if (this.disposed || refreshSignal.aborted || generation !== this.generation) return;
      const items = Object.freeze(entries.map(projectEntry));
      this.publish({
        rootSessionId: String(rootSessionId),
        status: 'ready',
        items,
        runningCount: items.filter(
          (item) => item.kind === 'agent' && item.activity === 'running',
        ).length,
      });
    } catch (error) {
      if (this.disposed || generation !== this.generation || isAbort(error, refreshSignal)) return;
      debugLogger.debug(`Unable to list DSH subagents: ${String(error)}`);
      this.publish({
        ...this.snapshot,
        rootSessionId: String(rootSessionId),
        status: 'error',
        error: 'Unable to load the Agent catalog.',
      });
    } finally {
      if (this.refreshController === controller) this.refreshController = undefined;
    }
  }

  activeAgentChanged(): void {
    this.refreshController?.abort();
    this.refreshController = undefined;
    this.generation += 1;
    this.publish({
      rootSessionId: String(this.rootSessionId() ?? ''),
      status: 'idle',
      items: Object.freeze([]),
      runningCount: 0,
    });
    this.queueRefresh();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.refreshController?.abort();
    this.refreshController = undefined;
    this.generation += 1;
    this.off();
    this.listeners.clear();
  }

  private queueRefresh(): void {
    if (this.disposed || this.refreshQueued) return;
    this.refreshQueued = true;
    queueMicrotask(() => {
      this.refreshQueued = false;
      if (this.disposed) return;
      void this.refresh();
    });
  }

  private publish(snapshot: SubagentCatalogSnapshot): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of this.listeners) listener();
  }
}
