/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModelInputModality = 'text' | 'image';

export interface ModelSelectionView {
  provider: string;
  model: string;
  name: string;
  inputModalities: readonly ModelInputModality[];
}

export interface ModelSelectionSnapshot {
  /** Immutable route used by the currently running DSH Agent. */
  current: ModelSelectionView;
  /** Persisted route that future DSH Agents will use. */
  default: ModelSelectionView;
}

export interface ModelSelectionRuntime {
  getSnapshot(): ModelSelectionSnapshot;
  subscribe(listener: () => void): () => void;
  listModels(signal?: AbortSignal): Promise<readonly ModelSelectionView[]>;
  hasConversation(): boolean;
  setModel(provider: string, model: string, signal?: AbortSignal): Promise<ModelSelectionView>;
  assertCurrentSupportsImages(signal?: AbortSignal): Promise<void>;
}

export function modelSelectionLabel(selection: ModelSelectionView): string {
  return `${selection.provider}/${selection.model}`;
}
