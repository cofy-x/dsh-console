/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { ModelSelectionRuntime } from '../model-selection-runtime.js';
import { modelCommand } from './model-command.js';
import { ModelDialog } from '../components/dialogs/model-dialog.js';

function runtime(): ModelSelectionRuntime {
  const text = {
    provider: 'deepseek-official',
    model: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    inputModalities: ['text'] as const,
  };
  const vision = {
    provider: 'deepseek-official',
    model: 'deepseek-v4-flash-vision-exp',
    name: 'DeepSeek V4 Flash Vision',
    inputModalities: ['text', 'image'] as const,
  };
  return {
    getSnapshot: () => ({ current: text, default: text }),
    subscribe: () => () => {},
    listModels: vi.fn(async () => [text, vision]),
    hasConversation: vi.fn(() => false),
    setModel: vi.fn(async () => vision),
    assertCurrentSupportsImages: vi.fn(async () => {}),
  };
}

describe('/model', () => {
  it('opens the interactive model dialog', async () => {
    const modelSelection = runtime();
    const context = createMockCommandContext({ services: { modelSelection } });
    const result = await modelCommand.action?.(context, '');
    expect(result).toMatchObject({ type: 'custom_dialog' });
    expect(result && 'component' in result ? result.component.type : undefined).toBe(
      ModelDialog,
    );
  });

  it('rejects textual arguments instead of silently selecting a model', async () => {
    const modelSelection = runtime();
    const context = createMockCommandContext({ services: { modelSelection } });
    const result = await modelCommand.action?.(
      context,
      'set deepseek-official deepseek-v4-flash-vision-exp',
    );
    expect(result).toMatchObject({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /model',
    });
    expect(modelSelection.setModel).not.toHaveBeenCalled();
  });

  it('does not expose argument completion', () => {
    expect(modelCommand.completion).toBeUndefined();
  });

  it('validates arguments before requiring the model runtime', async () => {
    const context = createMockCommandContext();
    const result = await modelCommand.action?.(context, 'list');
    expect(result).toMatchObject({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /model',
    });
  });
});
