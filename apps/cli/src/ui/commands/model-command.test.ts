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

  it('starts a new Agent with the selected model', async () => {
    const modelSelection = runtime();
    const context = createMockCommandContext({ services: { modelSelection } });
    const result = await modelCommand.action?.(
      context,
      'set deepseek-official deepseek-v4-flash-vision-exp',
    );
    expect(modelSelection.setModel).toHaveBeenCalledWith(
      'deepseek-official',
      'deepseek-v4-flash-vision-exp',
    );
    expect(result && 'content' in result ? result.content : '').toContain(
      'Started a new Agent',
    );
  });

  it('does not replace the Agent when the requested model is already active', async () => {
    const modelSelection = runtime();
    const context = createMockCommandContext({ services: { modelSelection } });
    const result = await modelCommand.action?.(
      context,
      'set deepseek-official deepseek-v4-flash',
    );
    expect(modelSelection.setModel).not.toHaveBeenCalled();
    expect(result && 'content' in result ? result.content : '').toContain('Already using');
  });

  it('asks before replacing an Agent that already has conversation state', async () => {
    const modelSelection = runtime();
    vi.mocked(modelSelection.hasConversation).mockReturnValue(true);
    const context = createMockCommandContext({
      invocation: { raw: '/model set deepseek-official deepseek-v4-flash-vision-exp' },
      services: { modelSelection },
    });
    const result = await modelCommand.action?.(
      context,
      'set deepseek-official deepseek-v4-flash-vision-exp',
    );
    expect(result).toMatchObject({
      type: 'confirm_action',
      originalInvocation: {
        raw: '/model set deepseek-official deepseek-v4-flash-vision-exp',
      },
    });
    expect(modelSelection.setModel).not.toHaveBeenCalled();
  });

  it('lists model routes and their input modalities', async () => {
    const modelSelection = runtime();
    const context = createMockCommandContext({ services: { modelSelection } });
    const result = await modelCommand.action?.(context, 'list');
    expect(result && 'content' in result ? result.content : '').toContain(
      'deepseek-v4-flash-vision-exp [text, image]',
    );
  });
});
