/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../../test-utils/render.js';
import { AppHeader } from './app-header.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeConfig } from '../../../test-utils/config.js';
import { loadHeaderArt } from '../../../utils/header-loader.js';

vi.mock('../../hooks/terminal/terminal-setup.js', () => ({
  getTerminalProgram: () => null,
}));

vi.mock('../../../utils/header-loader.js', () => ({
  loadHeaderArt: vi.fn().mockReturnValue(null),
  loadCustomAsciiArt: vi.fn().mockReturnValue(undefined),
}));

describe('<AppHeader />', () => {
  const uiState = {
    history: [],
    historyRemountKey: 0,
    nightly: false,
    terminalWidth: 80,
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders the DSH Console header', () => {
    const { lastFrame } = renderWithProviders(<AppHeader version="1.0.0" />, {
      config: makeFakeConfig(),
      uiState,
    });

    expect(lastFrame()).not.toBe('');
    expect(lastFrame()).not.toContain('ERROR');
    expect(lastFrame()).not.toContain('v1.0.0');
  });

  it('shows the exact version in debug mode', () => {
    const { lastFrame } = renderWithProviders(<AppHeader version="1.0.0" />, {
      config: makeFakeConfig({ debugMode: true }),
      uiState,
    });

    expect(lastFrame()).toContain('v1.0.0');
  });

  it('shows tips by default', () => {
    const result = renderWithProviders(<AppHeader version="1.0.0" />, {
      config: makeFakeConfig(),
      uiState,
    });
    expect(result.lastFrame()).toContain('TIPS');
  });

  it('uses the one-time bundled Pokemon override', () => {
    renderWithProviders(<AppHeader version="1.0.0" />, {
      config: makeFakeConfig({ pokemonNumber: 669 }),
      uiState,
    });

    expect(loadHeaderArt).toHaveBeenCalledWith('pokemon', undefined, 669);
  });
});
