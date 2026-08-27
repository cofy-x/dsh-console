/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import { CUSTOM_PRESET } from '@deepseek-ai/dsh-permission-presets';
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import type { DshCommandRuntime } from '../ui/command-runtime.js';
import type {
  PermissionOptionView,
  PermissionSelectionRuntime,
  PermissionSelectionSnapshot,
} from '../ui/permission-selection-runtime.js';

const FULL_ACCESS_PRESET = 'danger-full-access';

export class DshPermissionSelectionRuntime
  implements PermissionSelectionRuntime
{
  private readonly listeners = new Set<() => void>();
  private snapshot: PermissionSelectionSnapshot;
  private readonly offProjection: () => void;

  constructor(
    private readonly projections: Pick<
      SessionProjectionRegistry,
      'snapshot' | 'onChanged'
    >,
    private readonly commands: DshCommandRuntime,
    private readonly activeAgent: () => Agent | undefined,
  ) {
    this.snapshot = this.readSnapshot(false);
    this.offProjection = projections.onChanged((session, key) => {
      const agent = this.activeAgent();
      if (agent === undefined || session !== agent.session || key !== 'permissions') return;
      this.refresh();
    });
  }

  getSnapshot = (): PermissionSelectionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async setPermission(
    value: string,
    signal?: AbortSignal,
  ): Promise<PermissionOptionView> {
    signal?.throwIfAborted();
    if (this.snapshot.busy) {
      throw new Error('Another permission change is already in progress.');
    }
    if (!this.snapshot.available) {
      throw new Error('DSH permission presets are unavailable.');
    }
    const option = this.snapshot.options.find((candidate) => candidate.value === value);
    if (!option) throw new Error(`Unknown permission preset: ${value}`);
    if (this.snapshot.currentValue === value) return option;

    this.snapshot = Object.freeze({ ...this.snapshot, busy: true });
    this.emit();
    try {
      const result = await this.commands.execute(`/permission ${value}`, signal ?? new AbortController().signal);
      signal?.throwIfAborted();
      if (result.kind === 'error') {
        throw new Error(result.text ?? `Unable to switch permission preset to ${value}.`);
      }
      this.snapshot = this.readSnapshot(false);
      if (this.snapshot.currentValue !== value) {
        throw new Error(`DSH did not activate permission preset ${value}.`);
      }
      return option;
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

  private readSnapshot(busy: boolean): PermissionSelectionSnapshot {
    const agent = this.activeAgent();
    if (agent === undefined) {
      return Object.freeze({ available: false, options: Object.freeze([]), busy });
    }
    const selection = this.projections.snapshot(agent.session).values.permissions;
    if (!selection) {
      return Object.freeze({ available: false, options: Object.freeze([]), busy });
    }
    return Object.freeze({
      available: true,
      currentValue: selection.currentValue,
      options: Object.freeze(
        selection.options
          .filter((option) => option.value !== CUSTOM_PRESET)
          .map((option) =>
            Object.freeze({
              value: option.value,
              name: option.name,
              ...(option.description === undefined
                ? {}
                : { description: option.description }),
              requiresConfirmation: option.value === FULL_ACCESS_PRESET,
            }),
          ),
      ),
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
