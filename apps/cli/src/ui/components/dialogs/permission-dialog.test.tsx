/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import type { PermissionSelectionRuntime } from '../../permission-selection-runtime.js';
import { PermissionDialog } from './permission-dialog.js';

describe('PermissionDialog', () => {
  it('renders the current DSH permission projection', () => {
    const snapshot = {
      available: true,
      currentValue: 'workspace-write',
      options: [
        {
          value: 'workspace-write',
          name: 'Workspace write',
          description: 'Writes inside the workspace require approval.',
          requiresConfirmation: false,
        },
        {
          value: 'danger-full-access',
          name: 'Full access',
          requiresConfirmation: true,
        },
      ],
      busy: false,
    } as const;
    const runtime: PermissionSelectionRuntime = {
      getSnapshot: () => snapshot,
      subscribe: () => vi.fn(),
      setPermission: vi.fn(),
    };
    const { lastFrame } = renderWithProviders(
      <PermissionDialog runtime={runtime} onClose={vi.fn()} onSwitched={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Select DSH Permission');
    expect(lastFrame()).toContain('Workspace write Current');
    expect(lastFrame()).toContain('No restart required');
  });
});
