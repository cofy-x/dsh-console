/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type SubagentCatalogItemView =
  | {
      kind: 'agent';
      id: string;
      parentId: string;
      depth: number;
      label: string;
      mode: 'one-shot' | 'continuable';
      activity: 'running' | 'inactive';
      hasChildren: boolean;
    }
  | {
      kind: 'diagnostic';
      id: string;
      parentId: string;
      depth: number;
      reason: 'corrupt' | 'unsupported' | 'unavailable';
    };

export interface SubagentCatalogSnapshot {
  rootSessionId: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: readonly SubagentCatalogItemView[];
  runningCount: number;
  error?: string;
}

/** Read-only presentation catalog for the subagents below the Main Session. */
export interface SubagentCatalogRuntime {
  /** Returns the same snapshot object until catalog state changes. */
  getSnapshot(): SubagentCatalogSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(signal?: AbortSignal): Promise<void>;
  openTranscript(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<import('./subagent-transcript-runtime.js').SubagentTranscriptRuntime>;
}
