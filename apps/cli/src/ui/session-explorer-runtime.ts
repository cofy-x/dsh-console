/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConversationMessage } from './conversation-runtime.js';
import type { SessionListItemView } from './session-management-runtime.js';

export interface SessionSearchItem extends SessionListItemView {
  snippet?: string;
  parentSessionId?: string;
}

export interface SessionPreview {
  id: string;
  title?: string;
  parentSessionId?: string;
  messages: readonly ConversationMessage[];
  /** Only DSH turn/end boundaries are offered for persistent forks. */
  turns: ReadonlyArray<{ seq: number; turn: number; time: number }>;
}

export interface SessionSearchResult {
  items: readonly SessionSearchItem[];
  loading?: boolean;
  notice?: string;
}

export interface SessionExplorerRuntime {
  subscribe(listener: () => void): () => void;
  search(query: string, signal?: AbortSignal): Promise<SessionSearchResult>;
  preview(id: string, signal?: AbortSignal): Promise<SessionPreview>;
  rename(id: string, title: string, signal?: AbortSignal): Promise<string>;
  fork(id: string, boundary: number, signal?: AbortSignal): Promise<void>;
  dispose(): void;
}
