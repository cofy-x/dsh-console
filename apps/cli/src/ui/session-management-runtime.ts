/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SessionListItemView {
  id: string;
  title?: string;
  createdAt: number;
  current: boolean;
  persisted: boolean;
  resumable: boolean;
  resumeUnavailableReason?: string;
}

export interface SessionManagementSnapshot {
  currentSessionId: string;
}

export interface SessionTitleView {
  id: string;
  title: string;
}

export interface SessionManagementRuntime {
  getSnapshot(): SessionManagementSnapshot;
  subscribe(listener: () => void): () => void;
  listSessions(signal?: AbortSignal): Promise<readonly SessionListItemView[]>;
  resolveSessionTitles(
    sessionIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly SessionTitleView[]>;
  createNew(signal?: AbortSignal): Promise<void>;
  resumeLatest(signal?: AbortSignal): Promise<void>;
  resumeSession(sessionId: string, signal?: AbortSignal): Promise<void>;
  hasConversation(): boolean;
  isBusy(): boolean;
}
