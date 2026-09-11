/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { AgentPresets } from '@deepseek-ai/dsh-agent-presets';
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import type {
  AgentPresetOptionView,
  AgentPresetRuntime,
  AgentPresetSnapshot,
} from '../ui/agent-preset-runtime.js';
import { waitForSharedPromise } from './wait-for-shared-promise.js';

const EMPTY_OPTIONS = Object.freeze([]) as readonly AgentPresetOptionView[];

export class DshAgentPresetRuntime implements AgentPresetRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: AgentPresetSnapshot;
  private loading: Promise<void> | undefined;
  private readonly offProjection: () => void;

  constructor(
    private readonly presets: Pick<
      AgentPresets,
      'defaultId' | 'list' | 'select'
    >,
    private readonly projections: Pick<
      SessionProjectionRegistry,
      'snapshot' | 'onChanged'
    >,
    private readonly activeAgent: () => Agent | undefined,
    private readonly pendingPresetId: () => string | undefined,
    private readonly selectPendingPreset: (id: string) => void,
    private readonly onSelected: () => void,
  ) {
    this.snapshot = Object.freeze({
      status: 'idle',
      currentId: this.currentId(),
      options: EMPTY_OPTIONS,
      busy: false,
    });
    this.offProjection = projections.onChanged((session, key) => {
      const agent = this.activeAgent();
      if (
        agent === undefined ||
        session !== agent.session ||
        key !== 'agentPreset'
      )
        return;
      this.refreshCurrent();
    });
  }

  getSnapshot = (): AgentPresetSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async prepare(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (this.snapshot.status === 'ready') return;
    let loading = this.loading;
    if (loading === undefined) {
      loading = this.load().finally(() => {
        if (this.loading === loading) this.loading = undefined;
      });
      this.loading = loading;
    }
    return waitForSharedPromise(loading, signal);
  }

  async select(
    id: string,
    signal?: AbortSignal,
  ): Promise<AgentPresetOptionView> {
    await this.prepare(signal);
    signal?.throwIfAborted();
    const option = this.snapshot.options.find(
      (candidate) => candidate.id === id,
    );
    if (option === undefined) throw new Error(`Unknown Agent preset: ${id}`);
    if (option.broken !== undefined) {
      throw new Error(`Agent preset ${id} is unavailable: ${option.broken}`);
    }
    if (this.snapshot.currentId === id) return option;
    if (this.snapshot.busy) {
      throw new Error('Another Agent preset change is already in progress.');
    }

    const agent = this.activeAgent();
    if (agent === undefined) {
      this.selectPendingPreset(id);
      this.refreshCurrent();
      if (this.snapshot.currentId !== id) {
        throw new Error(`DSH did not select Agent preset ${id}.`);
      }
      this.onSelected();
      return option;
    }
    this.snapshot = Object.freeze({ ...this.snapshot, busy: true });
    this.emit();
    try {
      await this.presets.select(agent, id);
      // Harness selection is the durable commit point and cannot be cancelled.
      // Once it resolves, always reconcile every Console view even if the
      // caller aborted while the Host was committing the new composition.
      this.refreshCurrent();
      if (this.snapshot.currentId !== id) {
        throw new Error(`DSH did not activate Agent preset ${id}.`);
      }
      this.onSelected();
      return option;
    } finally {
      this.snapshot = Object.freeze({ ...this.snapshot, busy: false });
      this.emit();
    }
  }

  activeAgentChanged(): void {
    this.refreshCurrent();
  }

  dispose(): void {
    this.offProjection();
    this.listeners.clear();
  }

  private async load(): Promise<void> {
    this.snapshot = Object.freeze({
      ...this.snapshot,
      status: 'loading',
      error: undefined,
    });
    this.emit();
    try {
      const options = (await this.presets.list()).map((preset) =>
        Object.freeze({
          id: preset.id,
          name: preset.name ?? preset.id,
          ...(preset.description === undefined
            ? {}
            : { description: preset.description }),
          trust: preset.trust,
          isDefault: preset.id === this.presets.defaultId,
          ...(preset.broken === undefined ? {} : { broken: preset.broken }),
        }),
      );
      this.snapshot = Object.freeze({
        status: 'ready',
        currentId: this.currentId(),
        options: Object.freeze(options),
        busy: this.snapshot.busy,
      });
      this.emit();
    } catch (error) {
      this.snapshot = Object.freeze({
        ...this.snapshot,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit();
      throw error;
    }
  }

  private currentId(): string | undefined {
    const agent = this.activeAgent();
    if (agent === undefined)
      return this.pendingPresetId() ?? this.presets.defaultId;
    return (
      this.projections.snapshot(agent.session).values.agentPreset ??
      this.presets.defaultId
    );
  }

  private refreshCurrent(): void {
    this.snapshot = Object.freeze({
      ...this.snapshot,
      currentId: this.currentId(),
    });
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
