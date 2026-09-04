/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import type { SessionManagementRuntime } from '../../session-management-runtime.js';
import { SessionDialog } from './session-dialog.js';

describe('<SessionDialog />', () => {
  it('closes from the mouse-accessible header action', async () => {
    const onClose = vi.fn();
    const runtime = {
      listSessions: vi.fn(() => new Promise(() => undefined)),
    } as unknown as SessionManagementRuntime;
    const { lastFrame, stdin, simulateClick } = renderWithProviders(
      <SessionDialog runtime={runtime} onClose={onClose} />,
      { mouseEventsEnabled: true },
    );
    const frame = lastFrame() ?? '';
    const lines = frame.split('\n');
    const row = lines.findIndex((line) => line.includes('Esc to close'));
    const column = lines[row]?.indexOf('Esc to close') ?? -1;

    await simulateClick(stdin, column + 1, row + 1);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
