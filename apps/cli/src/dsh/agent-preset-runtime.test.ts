/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { AgentPresetRegistry } from '@deepseek-ai/dsh-agent-preset-registry';
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { describe, expect, it, vi } from 'vitest';
import {
  DshAgentPresetRuntime,
  resolveNewSessionPreset,
} from './agent-preset-runtime.js';

function liveHarness() {
  let active: Agent | undefined;
  let pending: string | undefined;
  const roster = {
    presets: [
      { id: 'standard', isDefault: true },
      { id: 'minimal', isDefault: false },
    ],
  };
  const presets = {
    defaultId: 'standard',
    remoteExportList: vi.fn(async () => roster),
    resolve: vi.fn(async (id?: string) => ({ id: id ?? presets.defaultId })),
    select: vi.fn(async (_agent: Agent, id: string) => id),
  };
  const selectPending = vi.fn((id: string) => {
    pending = id;
  });
  const runtime = new DshAgentPresetRuntime(
    presets,
    {
      snapshot: vi.fn(() => ({ values: { agentPreset: 'standard' } })),
      onChanged: vi.fn(() => vi.fn()),
    } as unknown as Pick<SessionProjectionRegistry, 'snapshot' | 'onChanged'>,
    () => active,
    () => pending,
    selectPending,
    vi.fn(),
  );
  return {
    roster,
    presets,
    runtime,
    selectPending,
    setActive: (agent: Agent) => {
      active = agent;
    },
  };
}

describe('DshAgentPresetRuntime', () => {
  it('cancels selection without cancelling another caller shared roster read', async () => {
    const h = liveHarness();
    let finishRead!: (roster: typeof h.roster) => void;
    const read = new Promise<typeof h.roster>((resolve) => {
      finishRead = resolve;
    });
    h.presets.remoteExportList.mockReturnValueOnce(read);
    const controller = new AbortController();
    const selection = h.runtime.select('minimal', controller.signal);
    const otherReader = h.runtime.prepare();
    controller.abort();
    await expect(selection).rejects.toMatchObject({ name: 'AbortError' });
    finishRead(h.roster);
    await otherReader;
    expect(h.runtime.getSnapshot().status).toBe('ready');
    expect(h.presets.remoteExportList).toHaveBeenCalledTimes(1);
    expect(h.selectPending).not.toHaveBeenCalled();
    h.runtime.dispose();
  });

  it('follows a changed Host default without inventing chooser policy', async () => {
    const h = liveHarness();
    h.presets.defaultId = 'host-default';
    h.roster.presets = [{ id: 'host-default', isDefault: true }];

    await h.runtime.prepare();
    expect(h.runtime.getSnapshot()).toMatchObject({
      currentId: 'host-default',
    });
    expect(h.selectPending).not.toHaveBeenCalled();
    expect(h.presets.select).not.toHaveBeenCalled();
    h.runtime.dispose();
  });

  it('refreshes roster membership and shares concurrent reads', async () => {
    const h = liveHarness();
    await Promise.all([h.runtime.prepare(), h.runtime.prepare()]);
    expect(h.presets.remoteExportList).toHaveBeenCalledTimes(1);
    h.roster.presets = [{ id: 'standard', isDefault: false }];
    await expect(h.runtime.select('minimal')).rejects.toThrow('Unknown');
    expect(h.runtime.getSnapshot().options).toEqual([
      { id: 'standard', name: 'standard', isDefault: false },
    ]);
    expect(h.selectPending).not.toHaveBeenCalled();
    h.runtime.dispose();
  });

  it('fails closed when a fresh policy read fails', async () => {
    const h = liveHarness();
    await h.runtime.prepare();
    h.presets.remoteExportList.mockRejectedValueOnce(
      new Error('Host unavailable'),
    );
    await expect(h.runtime.select('minimal')).rejects.toThrow(
      'Host unavailable',
    );
    expect(h.runtime.getSnapshot()).toMatchObject({
      status: 'error',
    });
    expect(h.selectPending).not.toHaveBeenCalled();
    await h.runtime.prepare();
    expect(h.runtime.getSnapshot().status).toBe('ready');
    h.runtime.dispose();
  });

  it('does not apply a selection to an Agent that appeared during the roster read', async () => {
    const h = liveHarness();
    h.presets.remoteExportList.mockImplementationOnce(async () => {
      h.setActive({ session: {} } as Agent);
      return h.roster;
    });
    await expect(h.runtime.select('minimal')).rejects.toThrow(
      'Session changed',
    );
    expect(h.presets.select).not.toHaveBeenCalled();
    expect(h.selectPending).not.toHaveBeenCalled();
    h.runtime.dispose();
  });

  it('lists official presets and switches the blank Agent', async () => {
    const agent = { session: {} } as Agent;
    let current = 'standard';
    const presets = {
      defaultId: 'standard',
      remoteExportList: vi.fn(async () => ({
        presets: [
          {
            id: 'standard',
            name: 'Standard',

            isDefault: true,
          },
          {
            id: 'minimal',
            name: 'Minimal',

            isDefault: false,
          },
        ],
      })),
      select: vi.fn(async (_agent: Agent, id: string) => {
        current = id;
        return id;
      }),
    } as unknown as Pick<
      AgentPresetRegistry,
      'defaultId' | 'remoteExportList' | 'select'
    >;
    const projections = {
      snapshot: vi.fn(() => ({ asOfSeq: 0, values: { agentPreset: current } })),
      onChanged: vi.fn(() => vi.fn()),
    } as unknown as Pick<SessionProjectionRegistry, 'snapshot' | 'onChanged'>;
    const onSelected = vi.fn();
    const runtime = new DshAgentPresetRuntime(
      presets,
      projections,
      () => agent,
      () => undefined,
      vi.fn(),
      onSelected,
    );

    await runtime.prepare();
    expect(runtime.getSnapshot()).toMatchObject({
      status: 'ready',
      currentId: 'standard',
      options: [
        { id: 'standard', isDefault: true },
        { id: 'minimal', isDefault: false },
      ],
    });
    await expect(runtime.select('minimal')).resolves.toMatchObject({
      id: 'minimal',
    });
    expect(presets.select).toHaveBeenCalledWith(agent, 'minimal');
    expect(onSelected).toHaveBeenCalledOnce();
  });

  it('reconciles a committed switch when the caller aborts during selection', async () => {
    const agent = { session: {} } as Agent;
    const controller = new AbortController();
    let current = 'standard';
    const presets = {
      defaultId: 'standard',
      remoteExportList: vi.fn(async () => ({
        presets: [
          {
            id: 'standard',

            isDefault: true,
          },
          {
            id: 'minimal',

            isDefault: false,
          },
        ],
      })),
      select: vi.fn(async (_agent: Agent, id: string) => {
        current = id;
        controller.abort();
        return id;
      }),
    } as unknown as Pick<
      AgentPresetRegistry,
      'defaultId' | 'remoteExportList' | 'select'
    >;
    const projections = {
      snapshot: vi.fn(() => ({ asOfSeq: 0, values: { agentPreset: current } })),
      onChanged: vi.fn(() => vi.fn()),
    } as unknown as Pick<SessionProjectionRegistry, 'snapshot' | 'onChanged'>;
    const onSelected = vi.fn();
    const runtime = new DshAgentPresetRuntime(
      presets,
      projections,
      () => agent,
      () => undefined,
      vi.fn(),
      onSelected,
    );

    await runtime.prepare();
    await expect(
      runtime.select('minimal', controller.signal),
    ).resolves.toMatchObject({
      id: 'minimal',
    });
    expect(runtime.getSnapshot()).toMatchObject({
      currentId: 'minimal',
      busy: false,
    });
    expect(onSelected).toHaveBeenCalledOnce();
  });

  it('discovers presets and selects one before an Agent is materialized', async () => {
    let pending: string | undefined;
    const selectPending = vi.fn((id: string) => {
      pending = id;
    });
    const presets = {
      defaultId: 'standard',
      remoteExportList: vi.fn(async () => ({
        presets: [
          {
            id: 'standard',

            isDefault: true,
            broken: 'missing Host service',
          },
          {
            id: 'minimal',

            isDefault: false,
          },
        ],
      })),
      select: vi.fn(),
    } as unknown as Pick<
      AgentPresetRegistry,
      'defaultId' | 'remoteExportList' | 'select'
    >;
    const runtime = new DshAgentPresetRuntime(
      presets,
      {
        snapshot: vi.fn(),
        onChanged: vi.fn(() => vi.fn()),
      },
      () => undefined,
      () => pending,
      selectPending,
      vi.fn(),
    );

    await runtime.prepare();
    expect(runtime.getSnapshot()).toMatchObject({
      status: 'ready',
      currentId: 'standard',
    });
    await expect(runtime.select('minimal')).resolves.toMatchObject({
      id: 'minimal',
    });
    expect(selectPending).toHaveBeenCalledWith('minimal');
    expect(presets.select).not.toHaveBeenCalled();
    expect(runtime.getSnapshot().currentId).toBe('minimal');
  });

  it('lets the Host reject selection after the Session starts', async () => {
    const agent = { session: {} } as Agent;
    const presets = {
      defaultId: 'standard',
      remoteExportList: vi.fn(async () => ({
        presets: [
          {
            id: 'standard',
            isDefault: true,
          },
          {
            id: 'minimal',
            isDefault: false,
          },
        ],
      })),
      select: vi.fn(async () => {
        throw new Error('This session has already started');
      }),
    } as unknown as Pick<
      AgentPresetRegistry,
      'defaultId' | 'remoteExportList' | 'select'
    >;
    const runtime = new DshAgentPresetRuntime(
      presets,
      {
        snapshot: vi.fn(() => ({
          asOfSeq: -1 as const,
          values: { agentPreset: 'standard' },
        })),
        onChanged: vi.fn(() => vi.fn()),
      },
      () => agent,
      () => undefined,
      vi.fn(),
      vi.fn(),
    );

    await runtime.prepare();

    expect(runtime.getSnapshot()).toMatchObject({
      status: 'ready',
      currentId: 'standard',
    });
    await expect(runtime.select('minimal')).rejects.toThrow(
      'This session has already started',
    );
    expect(presets.select).toHaveBeenCalledWith(agent, 'minimal');
    expect(runtime.getSnapshot().busy).toBe(false);
  });
});

describe('resolveNewSessionPreset', () => {
  it('delegates an unnamed Session to the Harness effective default', async () => {
    const h = liveHarness();
    h.presets.defaultId = 'deployment-default';
    await expect(resolveNewSessionPreset(h.presets)).resolves.toEqual({
      id: 'deployment-default',
    });
    expect(h.presets.remoteExportList).not.toHaveBeenCalled();
    expect(h.presets.resolve).toHaveBeenCalledWith();
    h.runtime.dispose();
  });

  it('delegates a deferred explicit selection to Harness', async () => {
    const h = liveHarness();
    await resolveNewSessionPreset(h.presets, 'minimal');
    expect(h.presets.resolve).toHaveBeenCalledWith('minimal');
    expect(h.presets.remoteExportList).not.toHaveBeenCalled();
    h.runtime.dispose();
  });
});
