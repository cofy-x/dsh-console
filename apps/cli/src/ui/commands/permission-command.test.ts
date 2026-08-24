/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { PermissionSelectionRuntime } from '../permission-selection-runtime.js';
import { PermissionDialog } from '../components/dialogs/permission-dialog.js';
import { permissionCommand } from './permission-command.js';

function runtime(): PermissionSelectionRuntime {
  const workspace = {
    value: 'workspace-write',
    name: 'Workspace write',
    requiresConfirmation: false,
  };
  const full = {
    value: 'danger-full-access',
    name: 'Full access',
    requiresConfirmation: true,
  };
  return {
    getSnapshot: () => ({
      available: true,
      currentValue: workspace.value,
      options: [workspace, full],
      busy: false,
    }),
    subscribe: () => vi.fn(),
    setPermission: vi.fn(async () => full),
  };
}

describe('/permission', () => {
  it('opens the interactive permission dialog', async () => {
    const permissionSelection = runtime();
    const context = createMockCommandContext({ services: { permissionSelection } });
    const result = await permissionCommand.action?.(context, '');

    expect(result).toMatchObject({ type: 'custom_dialog' });
    expect(result && 'component' in result ? result.component.type : undefined).toBe(
      PermissionDialog,
    );
  });

  it('supports direct canonical preset selection', async () => {
    const permissionSelection = runtime();
    const context = createMockCommandContext({
      invocation: {
        raw: '/permission danger-full-access',
        name: 'permission',
        args: 'danger-full-access',
        signal: new AbortController().signal,
      },
      services: { permissionSelection },
      overwriteConfirmed: true,
    });
    const result = await permissionCommand.action?.(context, 'danger-full-access');

    expect(permissionSelection.setPermission).toHaveBeenCalledWith(
      'danger-full-access',
      expect.any(AbortSignal),
    );
    expect(result && 'content' in result ? result.content : '').toContain('Full access');
  });

  it('confirms direct Full access selection before executing it', async () => {
    const permissionSelection = runtime();
    const context = createMockCommandContext({
      invocation: { raw: '/permission danger-full-access' },
      services: { permissionSelection },
    });
    const result = await permissionCommand.action?.(context, 'danger-full-access');

    expect(result).toMatchObject({
      type: 'confirm_action',
      originalInvocation: { raw: '/permission danger-full-access' },
    });
    expect(permissionSelection.setPermission).not.toHaveBeenCalled();
  });
});
