/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PermissionSelectionRuntime } from './permission-selection-runtime.js';
import type { PlanSelectionRuntime } from './plan-selection-runtime.js';

export type InteractionModeKind =
  | 'default'
  | 'plan'
  | 'full-access'
  | 'permission'
  | 'unavailable';

export interface InteractionModeSnapshot {
  kind: InteractionModeKind;
  label: string;
  permissionLabel?: string;
  permissionRequiresConfirmation: boolean;
  showPermission: boolean;
  pending: boolean;
  busy: boolean;
  canTogglePlan: boolean;
}

export interface InteractionModeRuntime {
  getSnapshot(): InteractionModeSnapshot;
  subscribe(listener: () => void): () => void;
  togglePlan(signal?: AbortSignal, active?: boolean): Promise<void>;
}

const DEFAULT_PRESET = 'workspace-write';
const FULL_ACCESS_PRESET = 'danger-full-access';

const permissionDisplayLabel = (
  value: string | undefined,
  configuredName: string | undefined,
): string | undefined => {
  if (configuredName !== undefined && configuredName !== value) {
    return configuredName;
  }
  switch (value) {
    case 'read-only':
      return 'Read only';
    case DEFAULT_PRESET:
      return 'Workspace write';
    case FULL_ACCESS_PRESET:
      return 'Full access';
    default:
      return configuredName ?? value;
  }
};

export class DefaultInteractionModeRuntime implements InteractionModeRuntime {
  private snapshot: InteractionModeSnapshot;
  private operating = false;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: ReadonlyArray<() => void>;

  constructor(
    private readonly plan: PlanSelectionRuntime,
    private readonly permissions: PermissionSelectionRuntime,
    private readonly prepare?: (signal: AbortSignal) => Promise<void>,
  ) {
    this.snapshot = this.readSnapshot();
    this.unsubscribe = [
      plan.subscribe(() => this.refresh()),
      permissions.subscribe(() => this.refresh()),
    ];
  }

  getSnapshot = (): InteractionModeSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async togglePlan(signal?: AbortSignal, active?: boolean): Promise<void> {
    signal?.throwIfAborted();
    if (this.snapshot.busy)
      throw new Error(
        'Another interaction mode change is already in progress.',
      );

    this.operating = true;
    this.refresh();
    try {
      if (this.prepare !== undefined && !this.plan.getSnapshot().available) {
        await this.prepare(signal ?? new AbortController().signal);
        signal?.throwIfAborted();
        this.refresh();
      }
      const plan = this.plan.getSnapshot();
      if (!plan.available) throw new Error('DSH plan mode is unavailable.');
      await this.plan.setActive(active ?? !plan.requestedActive, signal);
    } finally {
      this.operating = false;
      this.refresh();
    }
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.listeners.clear();
  }

  private readSnapshot(): InteractionModeSnapshot {
    const plan = this.plan.getSnapshot();
    const permissions = this.permissions.getSnapshot();
    const option = permissions.options.find(
      (candidate) => candidate.value === permissions.currentValue,
    );
    const permissionLabel = permissionDisplayLabel(
      permissions.currentValue,
      option?.name,
    );
    const common = {
      ...(permissionLabel === undefined ? {} : { permissionLabel }),
      permissionRequiresConfirmation: option?.requiresConfirmation === true,
      showPermission:
        plan.requestedActive &&
        permissions.available &&
        permissions.currentValue !== undefined &&
        permissions.currentValue !== DEFAULT_PRESET,
      pending: plan.pending,
      busy: this.operating || plan.busy || permissions.busy,
      canTogglePlan: plan.available || this.prepare !== undefined,
    };

    if (plan.requestedActive) {
      return Object.freeze({ kind: 'plan', label: 'Plan', ...common });
    }
    if (!permissions.available) {
      return Object.freeze({
        kind: 'unavailable',
        label: 'Default',
        ...common,
      });
    }
    if (permissions.currentValue === FULL_ACCESS_PRESET) {
      return Object.freeze({
        kind: 'full-access',
        label: 'Full access',
        ...common,
      });
    }
    if (permissions.currentValue === DEFAULT_PRESET) {
      return Object.freeze({ kind: 'default', label: 'Default', ...common });
    }
    return Object.freeze({
      kind: 'permission',
      label: permissionLabel ?? 'Custom permission',
      ...common,
    });
  }

  private refresh(): void {
    this.snapshot = this.readSnapshot();
    for (const listener of this.listeners) listener();
  }
}
