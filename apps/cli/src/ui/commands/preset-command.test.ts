/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { AgentPresetRuntime } from '../agent-preset-runtime.js';
import type { CommandContext } from './types.js';
import { presetCommand } from './preset-command.js';

describe('presetCommand', () => {
  it('completes preset ids with DSH metadata and status', async () => {
    const prepare = vi.fn(async () => undefined);
    const runtime: AgentPresetRuntime = {
      prepare,
      subscribe: () => vi.fn(),
      select: vi.fn(),
      getSnapshot: () => ({
        status: 'ready',
        currentId: 'standard',
        busy: false,
        options: [
          {
            id: 'standard',
            name: 'Standard Mode',
            description: 'Full-featured coding agent.',
            trust: 'system',
            isDefault: true,
          },
          {
            id: 'minimal',
            name: 'Minimal Mode',
            description: 'Single-tool coding agent.',
            trust: 'system',
            isDefault: false,
          },
        ],
      }),
    };
    const context = {
      services: { agentPreset: runtime },
    } as CommandContext;

    await expect(presetCommand.completion?.(context, '')).resolves.toEqual([
      {
        value: 'standard',
        description:
          'Standard Mode | Current, Default | Full-featured coding agent.',
      },
      {
        value: 'minimal',
        description: 'Minimal Mode | Single-tool coding agent.',
      },
    ]);
    expect(prepare).toHaveBeenCalledOnce();
  });
});
