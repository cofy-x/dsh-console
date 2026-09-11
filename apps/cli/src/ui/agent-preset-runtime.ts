/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AgentPresetOptionView {
  id: string;
  name: string;
  description?: string;
  trust: 'system' | 'user';
  isDefault: boolean;
  broken?: string;
}

export interface AgentPresetSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error';
  currentId?: string;
  options: readonly AgentPresetOptionView[];
  busy: boolean;
  error?: string;
}

export interface AgentPresetRuntime {
  getSnapshot(): AgentPresetSnapshot;
  subscribe(listener: () => void): () => void;
  prepare(signal?: AbortSignal): Promise<void>;
  select(id: string, signal?: AbortSignal): Promise<AgentPresetOptionView>;
}
