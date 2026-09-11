/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { AgentPresets } from '@deepseek-ai/dsh-agent-presets';
import type { SkillRegistry } from '@deepseek-ai/dsh-skill';
import { describe, expect, it, vi } from 'vitest';
import { DshSkillCatalogRuntime } from './skill-catalog-runtime.js';

describe('DshSkillCatalogRuntime', () => {
  it('projects only user-invocable Skills from the Agent composition', async () => {
    const agent = { session: { header: { cwd: '/workspace' } } } as Agent;
    const scoped = {
      list: vi.fn(async () => [
        {
          name: 'review-work',
          description: 'Review work',
          invocation: { userInvocable: true, modelInvocable: false },
        },
        {
          name: 'model-only',
          description: 'For the model',
          invocation: { userInvocable: false, modelInvocable: true },
        },
      ]),
    } as unknown as SkillRegistry;
    const presets = {
      serviceFor: vi.fn(() => scoped),
    } as unknown as Pick<AgentPresets, 'serviceFor'>;
    const runtime = new DshSkillCatalogRuntime(
      undefined,
      presets,
      () => agent,
      vi.fn(async () => agent),
      () => vi.fn(),
    );

    await runtime.prepare();
    expect(runtime.getSnapshot()).toEqual({
      status: 'ready',
      skills: [
        {
          name: 'review-work',
          description: 'Review work',
          modelInvocable: false,
        },
      ],
    });
  });

  it('reads the Host registry through the Agent scope', async () => {
    const agent = { session: { header: { cwd: '/workspace' } } } as Agent;
    const list = vi.fn(async () => []);
    const presets = {
      serviceFor: vi.fn(() => undefined),
    } as unknown as Pick<AgentPresets, 'serviceFor'>;
    const runtime = new DshSkillCatalogRuntime(
      { list } as unknown as SkillRegistry,
      presets,
      () => agent,
      vi.fn(async () => agent),
      () => vi.fn(),
    );

    await runtime.prepare();

    expect(runtime.getSnapshot()).toEqual({ status: 'ready', skills: [] });
    expect(presets.serviceFor).toHaveBeenCalledWith(agent, 'skills');
    expect(list).toHaveBeenCalledWith({
      cwd: '/workspace',
      scope: agent,
      signal: expect.any(AbortSignal),
    });
  });

  it('does not let one caller abort the shared catalog load', async () => {
    const agent = { session: { header: { cwd: '/workspace' } } } as Agent;
    let finish!: (value: never[]) => void;
    const list = vi.fn(
      () =>
        new Promise<never[]>((resolve) => {
          finish = resolve;
        }),
    );
    const runtime = new DshSkillCatalogRuntime(
      undefined,
      {
        serviceFor: vi.fn(() => ({ list })),
      } as unknown as Pick<AgentPresets, 'serviceFor'>,
      () => agent,
      vi.fn(async () => agent),
      () => vi.fn(),
    );
    const controller = new AbortController();
    const cancelled = runtime.prepare(controller.signal);
    const shared = runtime.prepare();

    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    finish([]);
    await expect(shared).resolves.toBeUndefined();
    expect(list).toHaveBeenCalledOnce();
    expect(runtime.getSnapshot()).toEqual({ status: 'ready', skills: [] });
  });

  it('restarts an invalidated load for the newly active Agent', async () => {
    const firstAgent = {
      session: { header: { cwd: '/first' } },
    } as Agent;
    const secondAgent = {
      session: { header: { cwd: '/second' } },
    } as Agent;
    let activeAgent = firstAgent;
    let finishFirst!: (value: never[]) => void;
    const list = vi.fn(({ scope }: { scope: Agent }) => {
      if (scope === firstAgent) {
        return new Promise<never[]>((resolve) => {
          finishFirst = resolve;
        });
      }
      return Promise.resolve([
        {
          name: 'second-agent-skill',
          description: 'Visible only to the second Agent',
          invocation: { userInvocable: true, modelInvocable: true },
        },
      ]);
    });
    const runtime = new DshSkillCatalogRuntime(
      undefined,
      {
        serviceFor: vi.fn(() => ({ list })),
      } as unknown as Pick<AgentPresets, 'serviceFor'>,
      () => activeAgent,
      vi.fn(async () => activeAgent),
      () => vi.fn(),
    );

    const firstPrepare = runtime.prepare();
    await vi.waitFor(() =>
      expect(list).toHaveBeenCalledWith({
        cwd: '/first',
        scope: firstAgent,
        signal: expect.any(AbortSignal),
      }),
    );
    activeAgent = secondAgent;
    runtime.activeAgentChanged();
    finishFirst([]);

    await firstPrepare;
    await vi.waitFor(() =>
      expect(runtime.getSnapshot()).toEqual({
        status: 'ready',
        skills: [
          {
            name: 'second-agent-skill',
            description: 'Visible only to the second Agent',
            modelInvocable: true,
          },
        ],
      }),
    );
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not restart an in-flight load after disposal', async () => {
    const agent = { session: { header: { cwd: '/workspace' } } } as Agent;
    let finish!: (value: never[]) => void;
    const list = vi.fn(
      () =>
        new Promise<never[]>((resolve) => {
          finish = resolve;
        }),
    );
    const runtime = new DshSkillCatalogRuntime(
      undefined,
      {
        serviceFor: vi.fn(() => ({ list })),
      } as unknown as Pick<AgentPresets, 'serviceFor'>,
      () => agent,
      vi.fn(async () => agent),
      () => vi.fn(),
    );

    const preparing = runtime.prepare();
    await vi.waitFor(() => expect(list).toHaveBeenCalledOnce());
    runtime.dispose();
    finish([]);

    await expect(preparing).resolves.toBeUndefined();
    expect(list).toHaveBeenCalledOnce();
  });
});
