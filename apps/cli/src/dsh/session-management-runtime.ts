/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
import { foldRequestHeader, SessionId } from '@deepseek-ai/dsh-session';
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query';
import type {
  SessionListItemView,
  SessionManagementRuntime,
  SessionManagementSnapshot,
} from '../ui/session-management-runtime.js';
import type { ModelSelectionView } from '../ui/model-selection-runtime.js';
import {
  modelSelectionFromView,
  modelSelectionView,
} from './model-selection-runtime.js';

const SESSION_PREFIX = 'dsh-console-';
const COMPLETION_PREFIX = 'dsh-console-completion-';
const SESSION_OBSERVATION_BATCH_SIZE = 8;

interface SessionManagementCallbacks {
  currentSelection(): ModelSelectionView;
  createFresh(selection: ModelSelection, signal?: AbortSignal): Promise<string>;
  resume(sessionId: SessionId, selection: ModelSelection, signal?: AbortSignal): Promise<string>;
  adoptCurrentModel(selection: ModelSelectionView): void;
  hasConversation(): boolean;
  isBusy(): boolean;
}

function isConsoleSession(id: string): boolean {
  return id.startsWith(SESSION_PREFIX) && !id.startsWith(COMPLETION_PREFIX);
}

function hasConversationEvents(events: ReadonlyArray<{ type: string }>): boolean {
  return events.some((event) =>
    event.type === 'user/message' ||
    event.type === 'assistant/message' ||
    event.type === 'tool/result',
  );
}

export class DshSessionManagementRuntime implements SessionManagementRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: SessionManagementSnapshot;
  private switching = false;

  constructor(
    private readonly query: SessionQueryEngine,
    private readonly llm: LlmRuntime,
    private readonly cwd: string,
    currentSessionId: string,
    private readonly callbacks: SessionManagementCallbacks,
  ) {
    this.snapshot = { currentSessionId };
  }

  getSnapshot = (): SessionManagementSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  hasConversation = (): boolean => this.callbacks.hasConversation();

  isBusy = (): boolean => this.switching || this.callbacks.isBusy();

  async listSessions(signal?: AbortSignal): Promise<readonly SessionListItemView[]> {
    const records = await this.query.filterSessions([
      { kind: 'cwd', values: [this.cwd] },
      { kind: 'parent', values: [null] },
    ], signal);
    signal?.throwIfAborted();
    const candidates = records.filter((record) => {
      const id = String(record.header.id);
      return isConsoleSession(id) && (
        record.persisted || id === this.snapshot.currentSessionId
      );
    });
    const observations: Array<{
      record: (typeof candidates)[number];
      hasConversation: boolean;
      resumable: boolean;
      resumeUnavailableReason?: string;
    }> = [];
    for (let offset = 0; offset < candidates.length; offset += SESSION_OBSERVATION_BATCH_SIZE) {
      signal?.throwIfAborted();
      const batch = candidates.slice(offset, offset + SESSION_OBSERVATION_BATCH_SIZE);
      observations.push(...await Promise.all(batch.map(async (record) => {
        if (!record.persisted) {
          return { record, hasConversation: false, resumable: false };
        }
        try {
          const events = await this.query.listEvents(record.header.id);
          return {
            record,
            hasConversation: hasConversationEvents(events),
            resumable: events.some((event) => event.type === 'request/header'),
          };
        } catch {
          return {
            record,
            hasConversation: true,
            resumable: false,
            resumeUnavailableReason: 'Session log could not be read.',
          };
        }
      })));
    }
    signal?.throwIfAborted();
    const visible = observations.filter(({ record, hasConversation, resumable }) =>
      String(record.header.id) === this.snapshot.currentSessionId || hasConversation || resumable,
    );
    const titles = await this.query.readTitleSnapshots(
      visible.map(({ record }) => record.header.id),
      signal,
    );
    signal?.throwIfAborted();
    const titleById = new Map<string, string>();
    for (const result of titles) {
      if (result.status === 'fulfilled' && result.value.title !== undefined) {
        titleById.set(String(result.sessionId), result.value.title.title);
      }
    }
    return visible.map(({ record, resumable, ...observation }): SessionListItemView => ({
      id: String(record.header.id),
      ...(titleById.has(String(record.header.id))
        ? { title: titleById.get(String(record.header.id)) }
        : {}),
      createdAt: record.header.createdAt,
      current: String(record.header.id) === this.snapshot.currentSessionId,
      persisted: record.persisted,
      resumable,
      ...(!resumable && record.persisted
        ? {
            resumeUnavailableReason:
              'resumeUnavailableReason' in observation
                ? observation.resumeUnavailableReason
                : 'Missing model route.',
          }
        : {}),
    }));
  }

  async createNew(signal?: AbortSignal): Promise<void> {
    this.beginSwitch();
    try {
      signal?.throwIfAborted();
      const current = this.callbacks.currentSelection();
      const sessionId = await this.callbacks.createFresh(
        modelSelectionFromView(current),
        signal,
      );
      this.commitCurrentSession(sessionId);
    } finally {
      this.switching = false;
    }
  }

  async resumeSession(sessionId: string, signal?: AbortSignal): Promise<void> {
    if (sessionId === this.snapshot.currentSessionId) return;
    if (!isConsoleSession(sessionId)) throw new Error('Session is not a dsh-console conversation.');
    this.beginSwitch();
    try {
      const id = SessionId(sessionId);
      const records = await this.query.filterSessions([
        { kind: 'id', values: [id] },
        { kind: 'cwd', values: [this.cwd] },
        { kind: 'parent', values: [null] },
        { kind: 'availability', values: ['persisted'] },
      ], signal);
      signal?.throwIfAborted();
      if (records.length !== 1) throw new Error('Session is unavailable or belongs to another workspace.');
      const log = await this.query.readSession(id);
      signal?.throwIfAborted();
      const header = foldRequestHeader(log.events);
      if (header === undefined) {
        throw new Error(
          hasConversationEvents(log.events)
            ? 'This Session predates model-route persistence and cannot be resumed safely.'
            : 'This Session is empty and cannot be resumed.',
        );
      }
      const resolved = await this.llm.resolveModelInfo(
        header.config.provider,
        header.config.model,
        signal,
      );
      signal?.throwIfAborted();
      const explicitReasoningEffort = header.adapterDefaults?.reasoningEffort
        ? undefined
        : header.config.reasoningEffort;
      const selected = modelSelectionView(
        resolved,
        explicitReasoningEffort === undefined
          ? undefined
          : String(explicitReasoningEffort),
      );
      const resumedSessionId = await this.callbacks.resume(
        id,
        modelSelectionFromView(selected),
        signal,
      );
      this.callbacks.adoptCurrentModel(selected);
      this.commitCurrentSession(resumedSessionId);
    } finally {
      this.switching = false;
    }
  }

  private beginSwitch(): void {
    if (this.switching) {
      throw new Error('Another Session change is already in progress.');
    }
    if (this.callbacks.isBusy()) {
      throw new Error('Cannot change Session while the current Agent is working.');
    }
    this.switching = true;
  }

  private commitCurrentSession(sessionId: string): void {
    this.snapshot = { currentSessionId: sessionId };
    for (const listener of this.listeners) listener();
  }
}
