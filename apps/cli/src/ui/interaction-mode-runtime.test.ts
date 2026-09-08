/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  PermissionSelectionRuntime,
  PermissionSelectionSnapshot,
} from './permission-selection-runtime.js';
import type {
  PlanSelectionRuntime,
  PlanSelectionSnapshot,
} from './plan-selection-runtime.js';
import { DefaultInteractionModeRuntime } from './interaction-mode-runtime.js';

const listeners = () => {
  const values = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      values.add(listener);
      return () => values.delete(listener);
    },
    emit: () => values.forEach((listener) => listener()),
  };
};

describe('DefaultInteractionModeRuntime', () => {
  it('toggles Plan without changing the permission preset', async () => {
    const planEvents = listeners();
    const permissionEvents = listeners();
    let planSnapshot: PlanSelectionSnapshot = {
      available: true,
      active: false,
      pending: false,
      requestedActive: false,
      busy: false,
    };
    let permissionSnapshot: PermissionSelectionSnapshot = {
      available: true,
      currentValue: 'workspace-write',
      options: [
        {
          value: 'workspace-write',
          name: 'workspace-write',
          requiresConfirmation: false,
        },
        {
          value: 'danger-full-access',
          name: 'danger-full-access',
          requiresConfirmation: true,
        },
      ],
      busy: false,
    };
    const plan: PlanSelectionRuntime = {
      getSnapshot: () => planSnapshot,
      subscribe: planEvents.subscribe,
      setActive: vi.fn(async (active: boolean) => {
        planSnapshot = { ...planSnapshot, active, requestedActive: active };
        planEvents.emit();
      }),
    };
    const permissions: PermissionSelectionRuntime = {
      getSnapshot: () => permissionSnapshot,
      subscribe: permissionEvents.subscribe,
      setPermission: vi.fn(async (value: string) => {
        permissionSnapshot = { ...permissionSnapshot, currentValue: value };
        permissionEvents.emit();
        return permissionSnapshot.options.find(
          (option) => option.value === value,
        )!;
      }),
    };
    const runtime = new DefaultInteractionModeRuntime(plan, permissions);

    expect(runtime.getSnapshot().kind).toBe('default');
    await runtime.togglePlan();
    expect(runtime.getSnapshot().kind).toBe('plan');
    await runtime.togglePlan();
    expect(runtime.getSnapshot().kind).toBe('default');
    expect(permissions.setPermission).not.toHaveBeenCalled();
  });

  it('prepares a lazy conversation before the first toggle', async () => {
    const planEvents = listeners();
    const permissionEvents = listeners();
    let planSnapshot: PlanSelectionSnapshot = {
      available: false,
      active: false,
      pending: false,
      requestedActive: false,
      busy: false,
    };
    let permissionSnapshot: PermissionSelectionSnapshot = {
      available: false,
      options: [],
      busy: false,
    };
    const plan: PlanSelectionRuntime = {
      getSnapshot: () => planSnapshot,
      subscribe: planEvents.subscribe,
      setActive: vi.fn(async (active: boolean) => {
        planSnapshot = { ...planSnapshot, active, requestedActive: active };
        planEvents.emit();
      }),
    };
    const permissions: PermissionSelectionRuntime = {
      getSnapshot: () => permissionSnapshot,
      subscribe: permissionEvents.subscribe,
      setPermission: vi.fn(),
    };
    const prepare = vi.fn(async () => {
      planSnapshot = { ...planSnapshot, available: true };
      permissionSnapshot = {
        available: true,
        currentValue: 'workspace-write',
        options: [
          {
            value: 'workspace-write',
            name: 'workspace-write',
            requiresConfirmation: false,
          },
        ],
        busy: false,
      };
    });
    const runtime = new DefaultInteractionModeRuntime(
      plan,
      permissions,
      prepare,
    );

    expect(runtime.getSnapshot().canTogglePlan).toBe(true);
    await runtime.togglePlan();

    expect(prepare).toHaveBeenCalledOnce();
    expect(plan.setActive).toHaveBeenCalledWith(true, undefined);
    expect(runtime.getSnapshot().kind).toBe('plan');
  });

  it('uses configured labels and preserves Full access when leaving Plan', async () => {
    let refreshPermission = () => {};
    const planEvents = listeners();
    let planSnapshot: PlanSelectionSnapshot = {
      available: true,
      active: true,
      pending: false,
      requestedActive: true,
      busy: false,
    };
    let permissionSnapshot: PermissionSelectionSnapshot = {
      available: true,
      currentValue: 'workspace-write',
      options: [
        {
          value: 'workspace-write',
          name: 'Team default',
          requiresConfirmation: false,
        },
        {
          value: 'danger-full-access',
          name: 'Unrestricted host',
          requiresConfirmation: true,
        },
      ],
      busy: false,
    };
    const plan: PlanSelectionRuntime = {
      getSnapshot: () => planSnapshot,
      subscribe: planEvents.subscribe,
      setActive: vi.fn(async (active: boolean) => {
        planSnapshot = { ...planSnapshot, active, requestedActive: active };
        planEvents.emit();
      }),
    };
    const permissions: PermissionSelectionRuntime = {
      getSnapshot: () => permissionSnapshot,
      subscribe: (listener) => {
        refreshPermission = listener;
        return () => {};
      },
      setPermission: vi.fn(async (value: string) => {
        permissionSnapshot = { ...permissionSnapshot, currentValue: value };
        refreshPermission();
        return permissionSnapshot.options.find(
          (option) => option.value === value,
        )!;
      }),
    };
    const runtime = new DefaultInteractionModeRuntime(plan, permissions);

    expect(runtime.getSnapshot()).toMatchObject({
      kind: 'plan',
      permissionLabel: 'Team default',
      showPermission: false,
    });

    permissionSnapshot = {
      ...permissionSnapshot,
      currentValue: 'danger-full-access',
    };
    refreshPermission();
    expect(runtime.getSnapshot()).toMatchObject({
      kind: 'plan',
      permissionLabel: 'Unrestricted host',
      permissionRequiresConfirmation: true,
      showPermission: true,
    });

    await runtime.togglePlan();
    expect(plan.setActive).toHaveBeenCalledWith(false, undefined);
    expect(permissions.setPermission).not.toHaveBeenCalled();
    expect(permissionSnapshot.currentValue).toBe('danger-full-access');
    expect(runtime.getSnapshot().kind).toBe('full-access');
  });
});
