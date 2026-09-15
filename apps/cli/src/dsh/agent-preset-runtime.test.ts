/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { AgentPresets } from '@deepseek-ai/dsh-agent-presets';
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { describe, expect, it, vi } from 'vitest';
import { DshAgentPresetRuntime } from './agent-preset-runtime.js';

describe('DshAgentPresetRuntime', () => {
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
            trust: 'system' as const,
            isDefault: true,
          },
          {
            id: 'minimal',
            name: 'Minimal',
            trust: 'system' as const,
            isDefault: false,
          },
        ],
        authorable: true,
        modeSelectionEnabled: true,
      })),
      select: vi.fn(async (_agent: Agent, id: string) => {
        current = id;
        return id;
      }),
    } as unknown as Pick<
      AgentPresets,
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
      modeSelectionEnabled: true,
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
            trust: 'system' as const,
            isDefault: true,
          },
          {
            id: 'minimal',
            trust: 'system' as const,
            isDefault: false,
          },
        ],
        authorable: true,
        modeSelectionEnabled: true,
      })),
      select: vi.fn(async (_agent: Agent, id: string) => {
        current = id;
        controller.abort();
        return id;
      }),
    } as unknown as Pick<
      AgentPresets,
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
            trust: 'system' as const,
            isDefault: true,
            broken: 'missing Host service',
          },
          {
            id: 'minimal',
            trust: 'system' as const,
            isDefault: false,
          },
        ],
        authorable: true,
        modeSelectionEnabled: true,
      })),
      select: vi.fn(),
    } as unknown as Pick<
      AgentPresets,
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

  it('follows the DSH roster policy when mode selection is disabled', async () => {
    const presets = {
      defaultId: 'standard',
      remoteExportList: vi.fn(async () => ({
        presets: [
          {
            id: 'standard',
            trust: 'system' as const,
            isDefault: true,
          },
        ],
        authorable: true,
        modeSelectionEnabled: false,
      })),
      select: vi.fn(),
    } as unknown as Pick<
      AgentPresets,
      'defaultId' | 'remoteExportList' | 'select'
    >;
    const runtime = new DshAgentPresetRuntime(
      presets,
      {
        snapshot: vi.fn(),
        onChanged: vi.fn(() => vi.fn()),
      },
      () => undefined,
      () => undefined,
      vi.fn(),
      vi.fn(),
    );

    await runtime.prepare();

    expect(runtime.getSnapshot()).toMatchObject({
      status: 'ready',
      modeSelectionEnabled: false,
      currentId: 'standard',
    });
    await expect(runtime.select('standard')).rejects.toThrow(
      'Agent preset selection is disabled by the DSH host.',
    );
    expect(presets.select).not.toHaveBeenCalled();
  });
});
