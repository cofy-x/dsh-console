/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model';
import { ReasoningEffortId, type LlmRuntime } from '@deepseek-ai/dsh-llm';
import { modelReasoningEffortLabel } from '../ui/model-selection-runtime.js';
import { DshModelSelectionRuntime } from './model-selection-runtime.js';

function dependencies() {
  const models = [
    {
      provider: 'deepseek-official',
      id: 'deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      inputModalities: ['text'] as const,
    },
    {
      provider: 'deepseek-official',
      id: 'deepseek-v4-flash-vision-exp',
      name: 'DeepSeek V4 Flash Vision',
      inputModalities: ['text', 'image'] as const,
    },
  ];
  const llm = {
    listProviders: vi.fn(() => [{ id: 'deepseek-official', name: 'DeepSeek' }]),
    listModels: vi.fn(async () => models),
    resolveModelInfo: vi.fn(async (_provider: string, model: string) => {
      const resolved = models.find((candidate) => candidate.id === model);
      if (!resolved) throw new Error(`unknown model ${model}`);
      return {
        ...resolved,
        context: {
          contextWindow:
            model === 'deepseek-v4-flash' ? 1_000_000 : 128_000,
        },
        reasoning: {
          efforts: [
            { id: ReasoningEffortId('low'), name: 'Low' },
            { id: ReasoningEffortId('high'), name: 'High' },
          ],
          defaultEffort: ReasoningEffortId('high'),
        },
      };
    }),
  } as unknown as LlmRuntime;
  const defaults = {
    currentSelection: vi.fn(() => ({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
    })),
    saveSelection: vi.fn(async () => {}),
  } as unknown as AgentDefaultModelConfig;
  return { llm, defaults };
}

describe('DshModelSelectionRuntime', () => {
  it('resolves canonical context capacity for listed models', async () => {
    const { llm, defaults } = dependencies();
    const runtime = await DshModelSelectionRuntime.create(
      llm,
      defaults,
      async () => {},
      () => false,
    );

    await expect(runtime.listModels()).resolves.toMatchObject([
      { model: 'deepseek-v4-flash', contextWindow: 1_000_000 },
      { model: 'deepseek-v4-flash-vision-exp', contextWindow: 128_000 },
    ]);
  });

  it('labels only canonical reasoning-capable models', async () => {
    const { llm, defaults } = dependencies();
    const runtime = await DshModelSelectionRuntime.create(
      llm,
      defaults,
      async () => {},
      () => false,
    );
    expect(modelReasoningEffortLabel(runtime.getSnapshot().current)).toBe('High');
    expect(modelReasoningEffortLabel({
      provider: 'deepseek-official',
      model: 'plain',
      name: 'Plain',
      inputModalities: ['text'],
    })).toBeUndefined();
  });

  it('keeps catalog models when context metadata is unavailable', async () => {
    const { llm, defaults } = dependencies();
    const runtime = await DshModelSelectionRuntime.create(
      llm,
      defaults,
      async () => {},
      () => false,
    );
    vi.mocked(llm.resolveModelInfo).mockRejectedValueOnce(
      new Error('metadata unavailable'),
    );

    const listed = await runtime.listModels();
    expect(listed).toMatchObject([
      { model: 'deepseek-v4-flash' },
      { model: 'deepseek-v4-flash-vision-exp', contextWindow: 128_000 },
    ]);
    expect(listed[0]).not.toHaveProperty('contextWindow');
  });

  it('activates and persists the selected route for a new Agent', async () => {
    const { llm, defaults } = dependencies();
    const activate = vi.fn(async () => {});
    const runtime = await DshModelSelectionRuntime.create(llm, defaults, activate, () => false);
    const listener = vi.fn();
    runtime.subscribe(listener);

    await runtime.setModel({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash-vision-exp',
      reasoningEffort: 'low',
    });

    expect(runtime.getSnapshot().current.model).toBe('deepseek-v4-flash-vision-exp');
    expect(runtime.getSnapshot().default.model).toBe('deepseek-v4-flash-vision-exp');
    expect(defaults.saveSelection).toHaveBeenCalledWith({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash-vision-exp',
      reasoningEffort: ReasoningEffortId('low'),
    });
    expect(activate).toHaveBeenCalledWith({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash-vision-exp',
      reasoningEffort: ReasoningEffortId('low'),
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('restores the previous default when the new Agent cannot be created', async () => {
    const { llm, defaults } = dependencies();
    const activate = vi.fn(async () => {
      throw new Error('agent creation failed');
    });
    const runtime = await DshModelSelectionRuntime.create(llm, defaults, activate, () => true);
    const listener = vi.fn();
    runtime.subscribe(listener);

    await expect(
      runtime.setModel({
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash-vision-exp',
      }),
    ).rejects.toThrow('agent creation failed');

    expect(defaults.saveSelection).toHaveBeenNthCalledWith(1, {
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash-vision-exp',
    });
    expect(defaults.saveSelection).toHaveBeenNthCalledWith(2, {
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
    });
    expect(runtime.getSnapshot().current.model).toBe('deepseek-v4-flash');
    expect(runtime.getSnapshot().default.model).toBe('deepseek-v4-flash');
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects an effort not advertised by the resolved model', async () => {
    const { llm, defaults } = dependencies();
    const activate = vi.fn(async () => {});
    const runtime = await DshModelSelectionRuntime.create(llm, defaults, activate, () => false);

    await expect(runtime.setModel({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      reasoningEffort: 'unsupported',
    })).rejects.toThrow('is not available');
    expect(defaults.saveSelection).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it('rejects image input on a text model with an actionable dialog route', async () => {
    const { llm, defaults } = dependencies();
    const runtime = await DshModelSelectionRuntime.create(
      llm,
      defaults,
      async () => {},
      () => false,
    );

    await expect(runtime.assertCurrentSupportsImages()).rejects.toThrow(
      'Run /model and select an image-capable model',
    );
  });
});
