/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model';
import type { LlmRuntime } from '@deepseek-ai/dsh-llm';
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
      return resolved;
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
  it('activates and persists the selected route for a new Agent', async () => {
    const { llm, defaults } = dependencies();
    const activate = vi.fn(async () => {});
    const runtime = await DshModelSelectionRuntime.create(llm, defaults, activate, () => false);
    const listener = vi.fn();
    runtime.subscribe(listener);

    await runtime.setModel('deepseek-official', 'deepseek-v4-flash-vision-exp');

    expect(runtime.getSnapshot().current.model).toBe('deepseek-v4-flash-vision-exp');
    expect(runtime.getSnapshot().default.model).toBe('deepseek-v4-flash-vision-exp');
    expect(defaults.saveSelection).toHaveBeenCalledWith({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash-vision-exp',
    });
    expect(activate).toHaveBeenCalledWith({
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash-vision-exp',
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
      runtime.setModel('deepseek-official', 'deepseek-v4-flash-vision-exp'),
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

  it('rejects image input on a text model with an actionable vision route', async () => {
    const { llm, defaults } = dependencies();
    const runtime = await DshModelSelectionRuntime.create(
      llm,
      defaults,
      async () => {},
      () => false,
    );

    await expect(runtime.assertCurrentSupportsImages()).rejects.toThrow(
      '/model set deepseek-official deepseek-v4-flash-vision-exp',
    );
  });
});
