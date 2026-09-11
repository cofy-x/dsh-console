/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { AgentPresets } from '@deepseek-ai/dsh-agent-presets';
import { isUserInvocable, type SkillRegistry } from '@deepseek-ai/dsh-skill';
import type {
  SkillCatalogRuntime,
  SkillCatalogSnapshot,
} from '../ui/skill-catalog-runtime.js';
import { waitForSharedPromise } from './wait-for-shared-promise.js';

const EMPTY_SKILLS = Object.freeze([]);

export class DshSkillCatalogRuntime implements SkillCatalogRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: SkillCatalogSnapshot = Object.freeze({
    status: 'idle',
    skills: EMPTY_SKILLS,
  });
  private loading: Promise<void> | undefined;
  private controller: AbortController | undefined;
  private readonly off: () => void;
  private generation = 0;
  private disposed = false;

  constructor(
    private readonly skills: SkillRegistry | undefined,
    private readonly presets: Pick<AgentPresets, 'serviceFor'>,
    private readonly activeAgent: () => Agent | undefined,
    private readonly ensureActiveAgent: (signal: AbortSignal) => Promise<Agent>,
    subscribe: (listener: () => void) => () => void,
  ) {
    this.off = subscribe(() => this.invalidate(true));
  }

  getSnapshot = (): SkillCatalogSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async prepare(signal?: AbortSignal): Promise<void> {
    if (this.disposed) return;
    while (this.snapshot.status !== 'ready') {
      if (this.disposed) return;
      signal?.throwIfAborted();
      const agent =
        this.activeAgent() ??
        (await this.ensureActiveAgent(signal ?? new AbortController().signal));
      signal?.throwIfAborted();
      let loading = this.loading;
      if (loading === undefined) {
        const controller = new AbortController();
        const generation = this.generation;
        this.controller = controller;
        // Defer load() so the shared promise is published before load-side
        // events can synchronously invalidate this generation.
        loading = Promise.resolve()
          .then(() => this.load(agent, controller.signal, generation))
          .finally(() => {
            if (this.loading === loading) this.loading = undefined;
            if (this.controller === controller) this.controller = undefined;
          });
        this.loading = loading;
      }
      await waitForSharedPromise(loading, signal);
    }
  }

  activeAgentChanged(): void {
    this.invalidate(false);
    if (this.activeAgent() !== undefined) void this.prepare().catch(() => {});
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    const controller = this.controller;
    this.controller = undefined;
    this.loading = undefined;
    controller?.abort();
    this.off();
    this.listeners.clear();
  }

  private invalidate(reload: boolean): void {
    if (this.disposed) return;
    this.generation += 1;
    const controller = this.controller;
    this.controller = undefined;
    this.loading = undefined;
    controller?.abort();
    this.snapshot = Object.freeze({ status: 'idle', skills: EMPTY_SKILLS });
    this.emit();
    if (reload && this.activeAgent() !== undefined) {
      void this.prepare().catch(() => {});
    }
  }

  private async load(
    agent: Agent,
    signal: AbortSignal,
    generation: number,
  ): Promise<void> {
    if (this.disposed || signal.aborted || generation !== this.generation)
      return;
    this.snapshot = Object.freeze({
      status: 'loading',
      skills: this.snapshot.skills,
    });
    this.emit();
    try {
      const registry = this.presets.serviceFor(agent, 'skills') ?? this.skills;
      if (registry === undefined) {
        throw new Error('No DSH Skill registry is available.');
      }
      const summaries = await registry.list({
        cwd: agent.session.header.cwd,
        scope: agent,
        signal,
      });
      signal.throwIfAborted();
      if (this.disposed || generation !== this.generation) return;
      const skills = summaries.filter(isUserInvocable).map((skill) =>
        Object.freeze({
          name: skill.name,
          description: skill.description,
          ...(skill.whenToUse === undefined
            ? {}
            : { whenToUse: skill.whenToUse }),
          modelInvocable: skill.invocation.modelInvocable,
        }),
      );
      this.snapshot = Object.freeze({
        status: 'ready',
        skills: Object.freeze(skills),
      });
      this.emit();
    } catch (error) {
      if (this.disposed || signal.aborted || generation !== this.generation)
        return;
      this.snapshot = Object.freeze({
        status: 'error',
        skills: this.snapshot.skills,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit();
      throw error;
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
