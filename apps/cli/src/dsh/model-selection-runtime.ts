/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import type {
  LlmModelInfo,
  LlmResolvedModelInfo,
  LlmRuntime,
  ModelModality,
} from '@deepseek-ai/dsh-llm';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import type {
  ModelInputModality,
  ModelSelectionRuntime,
  ModelSelectionSnapshot,
  ModelSelectionView,
  ModelSelectionInput,
} from '../ui/model-selection-runtime.js';
import { modelSelectionLabel } from '../ui/model-selection-runtime.js';

function inputModalities(model: LlmModelInfo): readonly ModelInputModality[] {
  return (model.inputModalities ?? ['text']).filter(
    (modality: ModelModality): modality is ModelInputModality =>
      modality === 'text' || modality === 'image',
  );
}

function contextWindow(model: LlmModelInfo): number | undefined {
  return 'context' in model
    ? (model as LlmResolvedModelInfo).context?.contextWindow
    : undefined;
}

export function modelSelectionView(
  model: LlmModelInfo,
  selectedEffort?: string,
): ModelSelectionView {
  const resolvedContextWindow = contextWindow(model);
  const reasoning = 'reasoning' in model
    ? (model as LlmResolvedModelInfo).reasoning
    : undefined;
  if (
    selectedEffort !== undefined &&
    !reasoning?.efforts.some((effort) => String(effort.id) === selectedEffort)
  ) {
    throw new Error(
      `Reasoning effort ${selectedEffort} is not available for ${model.provider}/${model.id}.`,
    );
  }
  return {
    provider: model.provider,
    model: model.id,
    name: model.name,
    inputModalities: inputModalities(model),
    ...(resolvedContextWindow === undefined
      ? {}
      : { contextWindow: resolvedContextWindow }),
    ...(reasoning === undefined
      ? {}
      : {
          reasoning: {
            efforts: reasoning.efforts.map((effort) => ({
              id: String(effort.id),
              name: effort.name,
              ...(effort.description === undefined
                ? {}
                : { description: effort.description }),
            })),
            ...(reasoning.defaultEffort === undefined
              ? {}
              : { defaultEffort: String(reasoning.defaultEffort) }),
            ...(selectedEffort === undefined ? {} : { selectedEffort }),
          },
        }),
  };
}

export function modelSelectionFromView(selection: ModelSelectionView): ModelSelection {
  const reasoningEffort = selection.reasoning?.selectedEffort;
  return {
    provider: selection.provider,
    model: selection.model,
    ...(reasoningEffort === undefined
      ? {}
      : { reasoningEffort: ReasoningEffortId(reasoningEffort) }),
  };
}

export class DshModelSelectionRuntime implements ModelSelectionRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: ModelSelectionSnapshot;

  private constructor(
    private readonly llm: LlmRuntime,
    private readonly defaults: AgentDefaultModelConfig,
    private readonly activate: (selection: ModelSelection) => Promise<void>,
    private readonly conversationExists: () => boolean,
    current: ModelSelectionView,
  ) {
    this.snapshot = { current, default: current };
  }

  static async create(
    llm: LlmRuntime,
    defaults: AgentDefaultModelConfig,
    activate: (selection: ModelSelection) => Promise<void>,
    conversationExists: () => boolean,
    signal?: AbortSignal,
  ): Promise<DshModelSelectionRuntime> {
    const selection = defaults.currentSelection();
    const current = modelSelectionView(
      await llm.resolveModelInfo(selection.provider, selection.model, signal),
      selection.reasoningEffort === undefined
        ? undefined
        : String(selection.reasoningEffort),
    );
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
    return Promise.all(
      models.flat().map(async (model) => {
        signal?.throwIfAborted();
        try {
          const resolved = await this.llm.resolveModelInfo(
            model.provider,
            model.id,
            signal,
          );
          signal?.throwIfAborted();
          return modelSelectionView(resolved);
        } catch (cause) {
          signal?.throwIfAborted();
          if (cause instanceof Error && cause.name === 'AbortError') throw cause;
          return modelSelectionView(model);
        }
      }),
    );
  }

  hasConversation = (): boolean => this.conversationExists();

  async setModel(
    selection: ModelSelectionInput,
    signal?: AbortSignal,
  ): Promise<ModelSelectionView> {
    const resolved = modelSelectionView(
      await this.llm.resolveModelInfo(selection.provider, selection.model, signal),
      selection.reasoningEffort,
    );
    signal?.throwIfAborted();
    const previousDefault = this.snapshot.default;
    const selected = modelSelectionFromView(resolved);
    await this.defaults.saveSelection(selected);
    try {
      signal?.throwIfAborted();
      await this.activate(selected);
    } catch (cause) {
      try {
        await this.defaults.saveSelection(modelSelectionFromView(previousDefault));
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
