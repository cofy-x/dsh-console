/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import { DialogCloseAction } from './dialog-close-action.js';

describe('<DialogCloseAction />', () => {
  it('closes the dialog with the mouse', async () => {
    const onClose = vi.fn();
    const { lastFrame, stdin, simulateClick } = renderWithProviders(
      <DialogCloseAction onClose={onClose} />,
      { mouseEventsEnabled: true },
    );
    const label = 'Esc to close';
    const frame = lastFrame() ?? '';
    const row = frame.split('\n').findIndex((line) => line.includes(label));
    const column = frame.split('\n')[row]?.indexOf(label) ?? -1;

    await simulateClick(stdin, column + 1, row + 1);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close while inactive', async () => {
    const onClose = vi.fn();
    const { stdin, simulateClick } = renderWithProviders(
      <DialogCloseAction onClose={onClose} isActive={false} />,
      { mouseEventsEnabled: true },
    );

    await simulateClick(stdin, 1, 1);

    expect(onClose).not.toHaveBeenCalled();
  });
});
