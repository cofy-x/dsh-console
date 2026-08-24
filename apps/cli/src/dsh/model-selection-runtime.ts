/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model';
import type { LlmModelInfo, LlmRuntime, ModelModality } from '@deepseek-ai/dsh-llm';
import type {
  ModelInputModality,
  ModelSelectionRuntime,
  ModelSelectionSnapshot,
  ModelSelectionView,
} from '../ui/model-selection-runtime.js';
import { modelSelectionLabel } from '../ui/model-selection-runtime.js';

function inputModalities(model: LlmModelInfo): readonly ModelInputModality[] {
  return (model.inputModalities ?? ['text']).filter(
    (modality: ModelModality): modality is ModelInputModality =>
      modality === 'text' || modality === 'image',
  );
}

export function modelSelectionView(model: LlmModelInfo): ModelSelectionView {
  return {
    provider: model.provider,
    model: model.id,
    name: model.name,
    inputModalities: inputModalities(model),
  };
}

export class DshModelSelectionRuntime implements ModelSelectionRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: ModelSelectionSnapshot;

  private constructor(
    private readonly llm: LlmRuntime,
    private readonly defaults: AgentDefaultModelConfig,
    private readonly activate: (selection: { provider: string; model: string }) => Promise<void>,
    private readonly conversationExists: () => boolean,
    current: ModelSelectionView,
  ) {
    this.snapshot = { current, default: current };
  }

  static async create(
    llm: LlmRuntime,
    defaults: AgentDefaultModelConfig,
    activate: (selection: { provider: string; model: string }) => Promise<void>,
    conversationExists: () => boolean,
    signal?: AbortSignal,
  ): Promise<DshModelSelectionRuntime> {
    const selection = defaults.currentSelection();
    const current = modelSelectionView(await llm.resolveModelInfo(selection.provider, selection.model, signal));
    signal?.throwIfAborted();
    return new DshModelSelectionRuntime(llm, defaults, activate, conversationExists, current);
  }

  getSnapshot = (): ModelSelectionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async listModels(signal?: AbortSignal): Promise<readonly ModelSelectionView[]> {
    const providers = this.llm.listProviders();
    const models = await Promise.all(
      providers.map(async ({ id }) => {
        signal?.throwIfAborted();
        const listed = await this.llm.listModels(id);
        signal?.throwIfAborted();
        return listed;
      }),
    );
    signal?.throwIfAborted();
    return models.flat().map(modelSelectionView);
  }

  hasConversation = (): boolean => this.conversationExists();

  async setModel(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<ModelSelectionView> {
    const resolved = modelSelectionView(await this.llm.resolveModelInfo(provider, model, signal));
    signal?.throwIfAborted();
    const previousDefault = this.snapshot.default;
    await this.defaults.saveSelection({ provider, model });
    try {
      signal?.throwIfAborted();
      await this.activate({ provider, model });
    } catch (cause) {
      try {
        await this.defaults.saveSelection({
          provider: previousDefault.provider,
          model: previousDefault.model,
        });
      } catch (rollbackError) {
        throw new AggregateError(
          [cause, rollbackError],
          'Unable to activate the selected model or restore the previous default.',
          { cause: rollbackError },
        );
      }
      throw cause;
    }
    this.snapshot = { current: resolved, default: resolved };
    for (const listener of this.listeners) listener();
    return resolved;
  }

  async assertCurrentSupportsImages(signal?: AbortSignal): Promise<void> {
    if (this.snapshot.current.inputModalities.includes('image')) return;
    signal?.throwIfAborted();
    const current = modelSelectionLabel(this.snapshot.current);
    throw new Error(
      `Current model ${current} does not support image input. Run /model and select an image-capable model to start a new Agent.`,
    );
  }

  adoptCurrent(selection: ModelSelectionView): void {
    this.snapshot = { ...this.snapshot, current: selection };
    for (const listener of this.listeners) listener();
  }
}
