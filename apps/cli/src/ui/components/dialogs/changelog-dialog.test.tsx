/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import { ChangelogDialog } from './changelog-dialog.js';

describe('<ChangelogDialog />', () => {
  it('starts at the latest release when Unreleased is empty', () => {
    const { lastFrame } = renderWithProviders(
      <ChangelogDialog
        content={'# Changelog\n\n## [Unreleased]\n\n## [1.0.0]\n\n- Ready'}
        onClose={vi.fn()}
      />,
      { width: 80 },
    );

    expect(lastFrame()).not.toContain('Unreleased');
    expect(lastFrame()).toContain('[1.0.0]');
    expect(lastFrame()).toContain('• Ready');
  });

  it('keeps Unreleased when it contains entries', () => {
    const { lastFrame } = renderWithProviders(
      <ChangelogDialog
        content={
          '# Changelog\n\n## [Unreleased]\n\n- In progress\n\n## [1.0.0]'
        }
        onClose={vi.fn()}
      />,
      { width: 80 },
    );

    expect(lastFrame()).toContain('Unreleased');
    expect(lastFrame()).toContain('• In progress');
  });
});
