/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { aboutCommand } from './about-command.js';
import { CommandKind, type CommandContext } from './types.js';

vi.mock('../../utils/version.js', () => ({
  getVersion: vi.fn().mockResolvedValue('0.1.0-test'),
}));

describe('aboutCommand', () => {
  it('projects current DSH model and local runtime information', async () => {
    const context = createMockCommandContext({
      services: {
        modelSelection: {
          getSnapshot: () => ({
            current: {
              provider: 'deepseek',
              model: 'deepseek-chat',
              name: 'DeepSeek Chat',
              inputModalities: ['text'],
            },
            default: {
              provider: 'deepseek',
              model: 'deepseek-chat',
              name: 'DeepSeek Chat',
              inputModalities: ['text'],
            },
          }),
        },
      },
      ui: { addItem: vi.fn() },
    } as unknown as CommandContext);

    await aboutCommand.action?.(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith({
      type: 'about',
      cliVersion: '0.1.0-test',
      osVersion: expect.any(String),
      modelVersion: 'deepseek/deepseek-chat',
    });
  });

  it('reports an unavailable model when no selection runtime is present', async () => {
    const context = createMockCommandContext({
      ui: { addItem: vi.fn() },
    } as unknown as CommandContext);

    await aboutCommand.action?.(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ modelVersion: 'Unavailable' }),
    );
  });

  it('is an auto-executing built-in command', () => {
    expect(aboutCommand.name).toBe('about');
    expect(aboutCommand.kind).toBe(CommandKind.BUILT_IN);
    expect(aboutCommand.autoExecute).toBe(true);
  });
});
