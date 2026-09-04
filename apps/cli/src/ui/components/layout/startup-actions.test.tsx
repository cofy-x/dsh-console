/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import { StartupActions } from './startup-actions.js';

describe('<StartupActions />', () => {
  it('shows useful empty-session entry points', () => {
    const { lastFrame } = renderWithProviders(<StartupActions />);
    expect(lastFrame()).toContain('Resume session · Changelog · Help');
  });

  it('runs the existing command path when an entry point is clicked', async () => {
    const handleFinalSubmit = vi.fn();
    const { lastFrame, stdin, simulateClick } = renderWithProviders(
      <StartupActions />,
      {
        mouseEventsEnabled: true,
        uiActions: { handleFinalSubmit },
      },
    );
    const frame = lastFrame() ?? '';
    const lines = frame.split('\n');
    const line = lines.find((value) => value.includes('Resume session')) ?? '';
    const row = lines.findIndex((value) => value === line);

    for (const [label, command] of [
      ['Resume session', '/sessions'],
      ['Changelog', '/changelog'],
      ['Help', '/help'],
    ] as const) {
      await simulateClick(stdin, line.indexOf(label) + 1, row + 1);
      expect(handleFinalSubmit).toHaveBeenLastCalledWith(command);
    }
  });
});
