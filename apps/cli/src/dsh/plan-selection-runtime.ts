/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PlanProjection } from '@deepseek-ai/dsh-plan-mode';
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import type { DshCommandRuntime } from '../ui/command-runtime.js';
import type {
  PlanSelectionRuntime,
  PlanSelectionSnapshot,
} from '../ui/plan-selection-runtime.js';

const isPlanProjection = (value: unknown): value is PlanProjection =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PlanProjection).active === 'boolean' &&
  typeof (value as PlanProjection).pending === 'boolean';

export class DshPlanSelectionRuntime implements PlanSelectionRuntime {
  private snapshot: PlanSelectionSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly offProjection: () => void;

  constructor(
    private readonly projections: SessionProjectionRegistry,
    private readonly commands: DshCommandRuntime,
    private readonly activeAgent: () => Agent | undefined,
  ) {
    this.snapshot = this.readSnapshot(false);
    this.offProjection = projections.onChanged((session, key) => {
      const agent = this.activeAgent();
      if (agent === undefined || session !== agent.session || key !== 'plan')
        return;
      this.refresh();
    });
  }

  getSnapshot = (): PlanSelectionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async setActive(active: boolean, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (this.snapshot.busy)
      throw new Error('Another plan mode change is already in progress.');
    if (!this.snapshot.available)
      throw new Error('DSH plan mode is unavailable.');
    if (this.snapshot.requestedActive === active) return;

    this.snapshot = Object.freeze({ ...this.snapshot, busy: true });
    this.emit();
    try {
      const result = await this.commands.execute(
        active ? '/plan' : '/plan off',
        signal ?? new AbortController().signal,
      );
      signal?.throwIfAborted();
      if (result.kind === 'error') {
        throw new Error(
          result.text ?? `Unable to turn plan mode ${active ? 'on' : 'off'}.`,
        );
      }
      this.snapshot = this.readSnapshot(false);
      if (this.snapshot.requestedActive !== active) {
        throw new Error(
          `DSH did not queue plan mode ${active ? 'activation' : 'deactivation'}.`,
        );
      }
    } finally {
      if (this.snapshot.busy) {
        this.snapshot = Object.freeze({ ...this.snapshot, busy: false });
      }
      this.emit();
    }
  }

  activeAgentChanged(): void {
    this.refresh();
  }

  dispose(): void {
    this.offProjection();
    this.listeners.clear();
  }

  private readSnapshot(busy: boolean): PlanSelectionSnapshot {
    const agent = this.activeAgent();
    if (agent === undefined) {
      return Object.freeze({
        available: false,
        active: false,
        pending: false,
        requestedActive: false,
        busy,
      });
    }
    const values = this.projections.snapshot(agent.session)
      .values as unknown as Record<string, unknown>;
    const plan = values['plan'];
    if (!isPlanProjection(plan)) {
      return Object.freeze({
        available: false,
        active: false,
        pending: false,
        requestedActive: false,
        busy,
      });
    }
    return Object.freeze({
      available: true,
      active: plan.active,
      pending: plan.pending,
      requestedActive: plan.pending ? !plan.active : plan.active,
      busy,
    });
  }

  private refresh(): void {
    this.snapshot = this.readSnapshot(this.snapshot.busy);
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
