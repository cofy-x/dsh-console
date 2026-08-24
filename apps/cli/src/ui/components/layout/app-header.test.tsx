/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders, persistentStateMock } from '../../../test-utils/render.js';
import { AppHeader } from './app-header.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeConfig } from '../../../test-utils/config.js';

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
  });

  it('shows tips until their persistent limit is reached', () => {
    persistentStateMock.setData({ tipsShown: 9 });
    const first = renderWithProviders(<AppHeader version="1.0.0" />, {
      config: makeFakeConfig(),
      uiState,
    });
    expect(first.lastFrame()).toContain('Tips');
    expect(persistentStateMock.get('tipsShown')).toBe(10);
    first.unmount();

    const second = renderWithProviders(<AppHeader version="1.0.0" />, {
      config: makeFakeConfig(),
      uiState,
    });
    expect(second.lastFrame()).not.toContain('Tips');
    second.unmount();
  });
});
