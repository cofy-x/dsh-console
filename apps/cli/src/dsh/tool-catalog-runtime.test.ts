/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { DshToolCatalogRuntime } from './tool-catalog-runtime.js';

describe('DshToolCatalogRuntime', () => {
  it('projects and sorts the current Agent tool schemas', () => {
    const agent = {} as Agent;
    const schemas = vi.fn(() => [
      {
        name: 'write_file',
        description: 'Write a file.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Destination path.' },
            content: { type: 'string' },
          },
          required: ['path'],
        },
      },
      { name: 'bash', description: 'Run a command.', parameters: {} },
    ]);
    const runtime = new DshToolCatalogRuntime(
      { schemas } as Pick<ToolRuntime, 'schemas'>,
      () => agent,
      () => vi.fn(),
    );

    expect(schemas).toHaveBeenCalledWith(agent);
    expect(runtime.getSnapshot()).toEqual({
      tools: [
        { name: 'bash', description: 'Run a command.', parameters: [] },
        {
          name: 'write_file',
          description: 'Write a file.',
          parameters: [
            { name: 'content', type: 'string', required: false },
            {
              name: 'path',
              type: 'string',
              description: 'Destination path.',
              required: true,
            },
          ],
        },
      ],
    });
  });

  it('refreshes for registry changes and Agent switches', () => {
    const first = {} as Agent;
    const second = {} as Agent;
    let active = first;
    let changed: (() => void) | undefined;
    const schemas = vi.fn((agent: Agent) => [
      { name: agent === first ? 'first' : 'second', description: 'tool', parameters: {} },
    ]);
    const listener = vi.fn();
    const runtime = new DshToolCatalogRuntime(
      { schemas } as Pick<ToolRuntime, 'schemas'>,
      () => active,
      (callback) => {
        changed = callback;
        return vi.fn();
      },
    );
    runtime.subscribe(listener);

    changed?.();
    active = second;
    runtime.activeAgentChanged();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot().tools[0]?.name).toBe('second');
  });

  it('publishes an empty catalog before the main Agent is materialized', () => {
    const schemas = vi.fn();
    const runtime = new DshToolCatalogRuntime(
      { schemas } as unknown as Pick<ToolRuntime, 'schemas'>,
      () => undefined,
      () => vi.fn(),
    );

    expect(runtime.getSnapshot()).toEqual({ tools: [] });
    expect(schemas).not.toHaveBeenCalled();
  });
});
