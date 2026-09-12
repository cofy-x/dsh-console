/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
import {
  foldRequestHeader,
  SessionId,
  type SessionEvent,
  type SessionHeader,
} from '@deepseek-ai/dsh-session';
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query';
import type {
  SessionExplorerRuntime,
  SessionPreview,
  SessionSearchResult,
} from '../ui/session-explorer-runtime.js';
import type { SessionManagementRuntime } from '../ui/session-management-runtime.js';
import type { ModelSelectionView } from '../ui/model-selection-runtime.js';
import {
  modelSelectionFromView,
  modelSelectionView,
} from './model-selection-runtime.js';
import { isConsoleSessionHeader } from './session-identity.js';
import { DshSessionProjector, type DshToolPresenter } from './projector.js';

interface ExplorerCallbacks {
  list(signal: AbortSignal): Promise<readonly CatalogSession[]>;
  search(
    query: string,
    sessionIds: readonly SessionId[],
    signal: AbortSignal,
  ): Promise<{ items: readonly CatalogSearchHit[]; hasMore: boolean }>;
  rename(id: SessionId, title: string, signal?: AbortSignal): Promise<string>;
  fork(
    id: SessionId,
    seed: readonly SessionEvent[],
    selected: ModelSelection,
    signal?: AbortSignal,
  ): Promise<void>;
  adoptCurrentModel(selection: ModelSelectionView): void;
}

const SEARCH_RESULT_LIMIT = 8;

interface CatalogSession {
  id: string;
  cwd?: string;
  updatedAt: number;
  running: boolean;
  blank: boolean;
  blankKnown: boolean;
  persisted: boolean;
  title?: string;
  parentSessionId?: string;
  origin?: 'subagent';
}

interface CatalogSearchHit {
  id: string;
  snippet: string;
}

export class DshSessionExplorerRuntime implements SessionExplorerRuntime {
  private writing = false;
  private catalog: readonly CatalogSession[] | undefined;
  private readonly listeners = new Set<() => void>();
  private readonly background = new AbortController();

  constructor(
    private readonly query: SessionQueryEngine,
    private readonly llm: LlmRuntime,
    private readonly cwd: string,
    private readonly management: SessionManagementRuntime,
    private readonly presenter: DshToolPresenter,
    private readonly callbacks: ExplorerCallbacks,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async search(
    text: string,
    signal?: AbortSignal,
  ): Promise<SessionSearchResult> {
    signal?.throwIfAborted();
    const requestSignal = signal ?? this.background.signal;
    const query = text.trim();
    const catalog = this.catalog ?? (await this.callbacks.list(requestSignal));
    this.catalog = catalog;
    signal?.throwIfAborted();
    const currentId = this.management.getSnapshot().currentSessionId;
    const eligible = catalog.filter(
      (item) =>
        item.cwd === this.cwd &&
        isConsoleSessionHeader({
          id: SessionId(item.id),
          cwd: item.cwd,
          createdAt: item.updatedAt,
          ...(item.parentSessionId === undefined
            ? {}
            : { parentSession: SessionId(item.parentSessionId) }),
          ...(item.origin === undefined ? {} : { origin: item.origin }),
        } as SessionHeader) &&
        (item.persisted || item.id === currentId),
    );
    const titleMap = new Map(
      eligible.flatMap((item) => {
        const title = item.title;
        return title === undefined ? [] : [[item.id, title] as const];
      }),
    );
    const nonEmpty = eligible.filter((item) => !item.blankKnown || !item.blank);
    const hits = new Map<string, string>();
    const needle = query.toLocaleLowerCase();
    const localMatches =
      query === ''
        ? []
        : eligible.filter((item) =>
            `${item.id} ${titleMap.get(item.id) ?? ''}`
              .toLocaleLowerCase()
              .includes(needle),
          );
    let notice: string | undefined;
    if (query !== '' && localMatches.length < SEARCH_RESULT_LIMIT) {
      try {
        const result = await this.callbacks.search(
          query,
          eligible.map((item) => SessionId(item.id)),
          requestSignal,
        );
        signal?.throwIfAborted();
        for (const hit of result.items) hits.set(hit.id, hit.snippet);
        if (result.hasMore)
          notice = `${notice ? `${notice} ` : ''}More search results are available; refine the query.`;
      } catch {
        signal?.throwIfAborted();
        if (localMatches.length === 0)
          notice = `${notice ? `${notice} ` : ''}Conversation search is unavailable.`;
      }
    }
    const visible = query === '' ? nonEmpty : eligible;
    const hitRank = new Map(
      [...hits.keys()].map((id, index) => [id, index] as const),
    );
    const matchRank = (item: CatalogSession): number => {
      const title = titleMap.get(item.id)?.toLocaleLowerCase();
      if (title === needle) return 0;
      if (title?.startsWith(needle)) return 1;
      if (title?.includes(needle)) return 2;
      if (item.id.toLocaleLowerCase().includes(needle)) return 3;
      return 4 + (hitRank.get(item.id) ?? Number.MAX_SAFE_INTEGER);
    };
    return {
      items: visible
        .filter(
          (item) =>
            query === '' ||
            hits.has(item.id) ||
            `${item.id} ${titleMap.get(item.id) ?? ''}`
              .toLocaleLowerCase()
              .includes(needle),
        )
        .sort((a, b) =>
          query === ''
            ? b.updatedAt - a.updatedAt
            : matchRank(a) - matchRank(b) || b.updatedAt - a.updatedAt,
        )
        .map((item) => ({
          id: item.id,
          title: titleMap.get(item.id),
          createdAt: item.updatedAt,
          current: item.id === currentId,
          persisted: item.persisted,
          resumable: item.persisted && (!item.running || item.id === currentId),
          snippet: hits.get(item.id),
          parentSessionId: item.parentSessionId,
        })),
      ...(notice === undefined ? {} : { notice }),
    };
  }

  invalidateSession(_id?: string): void {
    this.catalog = undefined;
    this.notify();
  }

  dispose(): void {
    this.background.abort();
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  async preview(id: string, signal?: AbortSignal): Promise<SessionPreview> {
    const log = await this.readEligible(id, signal);
    const titles = await this.query.readTitleSnapshots([SessionId(id)], signal);
    signal?.throwIfAborted();
    const projector = new DshSessionProjector(id, 'history', this.presenter);
    projector.replay(log.events);
    const title = titles[0];
    return {
      id,
      title:
        title?.status === 'fulfilled' ? title.value.title?.title : undefined,
      parentSessionId:
        log.session.parentSession === undefined
          ? undefined
          : String(log.session.parentSession),
      messages: projector.getSnapshot().messages,
      turns: log.events.flatMap((event) =>
        event.type === 'turn/end'
          ? [
              {
                seq: Number(event.seq),
                turn: event.data.turn,
                time: event.time,
              },
            ]
          : [],
      ),
    };
  }

  async rename(
    id: string,
    title: string,
    signal?: AbortSignal,
  ): Promise<string> {
    this.beginWrite();
    try {
      if (!title.trim()) throw new Error('A Session title cannot be empty.');
      await this.readEligible(id, signal);
      signal?.throwIfAborted();
      const accepted = await this.callbacks.rename(
        SessionId(id),
        title,
        signal,
      );
      if (this.catalog !== undefined)
        this.catalog = this.catalog.map((item) =>
          item.id === id ? { ...item, title: accepted } : item,
        );
      return accepted;
    } finally {
      this.writing = false;
    }
  }

  async fork(
    id: string,
    boundary: number,
    signal?: AbortSignal,
  ): Promise<void> {
    this.beginWrite();
    try {
      const log = await this.readEligible(id, signal);
      const index = log.events.findIndex(
        (event) => event.seq === boundary && event.type === 'turn/end',
      );
      if (index < 0) throw new Error('Choose a completed Turn before forking.');
      const seed = log.events.slice(0, index + 1);
      const header = foldRequestHeader(seed);
      if (header === undefined)
        throw new Error('This history has no restorable model route.');
      const model = await this.llm.resolveModelInfo(
        header.config.provider,
        header.config.model,
        signal,
      );
      signal?.throwIfAborted();
      const effort = header.adapterDefaults?.reasoningEffort
        ? undefined
        : header.config.reasoningEffort;
      const selected = modelSelectionView(
        model,
        effort === undefined ? undefined : String(effort),
      );
      await this.callbacks.fork(
        SessionId(id),
        seed,
        modelSelectionFromView(selected),
        signal,
      );
      // The callback creates a new Session id unknown to the cached header list.
      this.catalog = undefined;
      this.callbacks.adoptCurrentModel(selected);
    } finally {
      this.writing = false;
    }
  }

  private beginWrite(): void {
    if (this.writing || this.management.isBusy())
      throw new Error(
        'Wait for the current Agent operation before changing Sessions.',
      );
    this.writing = true;
  }

  private async readEligible(id: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    let log;
    try {
      log = await this.query.readSession(SessionId(id));
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error(
        'This Session history cannot be read safely by the current DSH version. Its source log was left unchanged.',
        { cause: error },
      );
    }
    signal?.throwIfAborted();
    if (log.session.cwd !== this.cwd || !isConsoleSessionHeader(log.session)) {
      throw new Error(
        'Session is unavailable or belongs to another workspace.',
      );
    }
    return log;
  }
}
