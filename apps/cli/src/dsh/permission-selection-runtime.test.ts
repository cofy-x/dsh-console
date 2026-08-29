/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { describe, expect, it, vi } from 'vitest';
import type { DshCommandRuntime } from '../ui/command-runtime.js';
import { DshPermissionSelectionRuntime } from './permission-selection-runtime.js';

describe('DshPermissionSelectionRuntime', () => {
  it('projects official permission values and switches through the DSH command', async () => {
    const agent = { session: {} } as Agent;
    let currentValue = 'workspace-write';
    let changed: Parameters<
      SessionProjectionRegistry['onChanged']
    >[0] = () => {};
    const projections = {
      snapshot: vi.fn(() => ({
        asOfSeq: 0,
        values: {
          permissions: {
            currentValue,
            options: [
              { value: 'workspace-write', name: 'Workspace write' },
              { value: 'danger-full-access', name: 'Full access' },
            ],
          },
        },
      })),
      onChanged: vi.fn((listener) => {
        changed = listener;
        return vi.fn();
      }),
    } as unknown as Pick<SessionProjectionRegistry, 'snapshot' | 'onChanged'>;
    const commands: DshCommandRuntime = {
      getSnapshot: () => ({ commands: [] }),
      subscribe: () => vi.fn(),
      prepare: vi.fn(async () => undefined),
      execute: vi.fn(async () => {
        currentValue = 'danger-full-access';
        changed(agent.session, 'permissions', {}, 1);
        return { kind: 'success', text: 'preset danger-full-access' };
      }),
    };
    const runtime = new DshPermissionSelectionRuntime(
      projections,
      commands,
      () => agent,
    );

    expect(runtime.getSnapshot()).toMatchObject({
      available: true,
      currentValue: 'workspace-write',
      options: [
        { value: 'workspace-write', requiresConfirmation: false },
        { value: 'danger-full-access', requiresConfirmation: true },
      ],
    });
    await expect(
      runtime.setPermission('danger-full-access'),
    ).resolves.toMatchObject({
      value: 'danger-full-access',
    });
    expect(commands.execute).toHaveBeenCalledWith(
      '/permission danger-full-access',
      expect.any(AbortSignal),
    );
    expect(runtime.getSnapshot()).toMatchObject({
      currentValue: 'danger-full-access',
      busy: false,
    });
  });

  it('reports an unavailable projection without fabricating presets', () => {
    const projections = {
      snapshot: () => ({ asOfSeq: -1, values: {} }),
      onChanged: () => vi.fn(),
    } as unknown as Pick<SessionProjectionRegistry, 'snapshot' | 'onChanged'>;
    const commands = {
      getSnapshot: () => ({ commands: [] }),
      subscribe: () => vi.fn(),
      execute: vi.fn(),
    } as unknown as DshCommandRuntime;
    const runtime = new DshPermissionSelectionRuntime(
      projections,
      commands,
      () => ({ session: {} }) as Agent,
    );

    expect(runtime.getSnapshot()).toEqual({
      available: false,
      options: [],
      busy: false,
    });
  });

  it('is unavailable before the main Agent is materialized', () => {
    const snapshot = vi.fn();
    const projections = {
      snapshot,
      onChanged: () => vi.fn(),
    } as unknown as Pick<SessionProjectionRegistry, 'snapshot' | 'onChanged'>;
    const commands = {
      getSnapshot: () => ({ commands: [] }),
      subscribe: () => vi.fn(),
      execute: vi.fn(),
    } as unknown as DshCommandRuntime;
    const runtime = new DshPermissionSelectionRuntime(
      projections,
      commands,
      () => undefined,
    );

    expect(runtime.getSnapshot()).toEqual({
      available: false,
      options: [],
      busy: false,
    });
    expect(snapshot).not.toHaveBeenCalled();
  });
});
