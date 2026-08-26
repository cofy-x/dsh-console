/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModelInputModality = 'text' | 'image';

export interface ModelReasoningEffortView {
  id: string;
  name: string;
  description?: string;
}

export interface ModelReasoningView {
  efforts: readonly ModelReasoningEffortView[];
  defaultEffort?: string;
  /** The explicit effort fixed to the active Agent. Absence preserves the provider default. */
  selectedEffort?: string;
}

export interface ModelSelectionView {
  provider: string;
  model: string;
  name: string;
  inputModalities: readonly ModelInputModality[];
  contextWindow?: number;
  reasoning?: ModelReasoningView;
}

export interface ModelSelectionInput {
  provider: string;
  model: string;
  reasoningEffort?: string;
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
  setModel(selection: ModelSelectionInput, signal?: AbortSignal): Promise<ModelSelectionView>;
  assertCurrentSupportsImages(signal?: AbortSignal): Promise<void>;
}

export function modelSelectionLabel(selection: ModelSelectionView): string {
  return `${selection.provider}/${selection.model}`;
}

export function modelReasoningEffortLabel(selection: ModelSelectionView): string | undefined {
  const reasoning = selection.reasoning;
  if (reasoning === undefined) return undefined;
  const selected = reasoning.selectedEffort;
  if (selected === undefined) {
    return reasoning.efforts.find(
      (effort) => effort.id === reasoning.defaultEffort,
    )?.name ?? 'Provider default';
  }
  return reasoning.efforts.find((effort) => effort.id === selected)?.name ?? selected;
}
