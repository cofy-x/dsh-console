/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { DshToolPresentationAdapter } from './tool-presenter.js';

describe('DshToolPresentationAdapter', () => {
  it('uses official call and result presenters with parsed arguments and meta', () => {
    const presentCall = vi.fn(() => ({
      card: 'generic' as const,
      title: 'Read README',
      rawInput: 'README.md',
    }));
    const presentResult = vi.fn(() => ({
      card: 'read' as const,
      title: 'README.md',
      path: 'README.md',
      offset: 1,
      lines: [{ number: 1, text: '# title' }],
      totalLines: 1,
    }));
    const tools = {
      get: vi.fn(() => ({ presentCall, presentResult })),
    } as unknown as Pick<ToolRuntime, 'get'>;
    const adapter = new DshToolPresentationAdapter(tools);

    expect(adapter.presentCall('read', '{"file_path":"README.md"}')).toEqual({
      kind: 'card',
      title: 'Read README',
      description: 'README.md',
    });
    expect(adapter.presentResult('read', '{"file_path":"README.md"}', {
      content: [{ type: 'text', text: '# title' }],
      isError: false,
      meta: { window: true },
    })).toEqual({
      kind: 'card',
      title: 'README.md',
      resultDisplay: {
        type: 'read',
        path: 'README.md',
        offset: 1,
        lines: [{ number: 1, text: '# title' }],
        totalLines: 1,
      },
    });
    expect(presentResult).toHaveBeenCalledWith(
      { file_path: 'README.md' },
      expect.objectContaining({ meta: { window: true } }),
    );
  });

  it('maps multi-file diffs and contains presenter failures', () => {
    const tools = {
      get: vi.fn(() => ({
        presentResult: vi.fn(() => ({
          card: 'diff' as const,
          diffs: [
            { path: 'a.ts', oldText: 'old', newText: 'new' },
            { path: 'b.ts', oldText: null, newText: 'created' },
          ],
        })),
      })),
    } as unknown as Pick<ToolRuntime, 'get'>;
    const adapter = new DshToolPresentationAdapter(tools);
    expect(
      adapter.presentResult('edit', '{}', { content: [], isError: false }),
    ).toMatchObject({
      kind: 'card',
      resultDisplay: {
        type: 'diff',
        content: { fileName: '2 files' },
      },
    });

    const throwing = new DshToolPresentationAdapter({
      get: () => ({ presentCall: () => { throw new Error('broken'); } }) as never,
    });
    expect(throwing.presentCall('tool', '{}')).toBeUndefined();
    expect(throwing.presentCall('tool', 'not-json')).toBeUndefined();
  });

  it('presents todo updates as compact receipts and keeps failures detailed', () => {
    const tools = { get: vi.fn() } as unknown as Pick<ToolRuntime, 'get'>;
    const adapter = new DshToolPresentationAdapter(tools);
    const argumentsJson = JSON.stringify({
      todos: [
        { content: 'first', status: 'completed' },
        { content: 'second', status: 'in_progress' },
        { content: 'third', status: 'pending' },
      ],
    });

    expect(adapter.presentCall('todo_write', argumentsJson)).toEqual({
      kind: 'compact',
      label: 'Updating todo list...',
    });
    expect(
      adapter.presentResult('todo_write', argumentsJson, {
        content: [],
        isError: false,
      }),
    ).toEqual({
      kind: 'compact',
      label: 'Todo | 1 completed | 1 active | 1 pending',
    });
    expect(
      adapter.presentResult('todo_write', '{"todos":[]}', {
        content: [],
        isError: false,
      }),
    ).toEqual({ kind: 'compact', label: 'Todo list cleared' });
    expect(
      adapter.presentResult(
        'todo_write',
        '{"todos":[{"content":"done","status":"completed"}]}',
        { content: [], isError: false },
      ),
    ).toEqual({ kind: 'compact', label: 'Todo completed | 1/1' });
    expect(
      adapter.presentResult('todo_write', argumentsJson, {
        content: [{ type: 'text', text: 'invalid todo list' }],
        isError: true,
      }),
    ).toEqual({
      kind: 'card',
      title: 'Update todo list',
      description: 'Todo update failed',
    });
    expect(tools.get).not.toHaveBeenCalled();
  });
});
