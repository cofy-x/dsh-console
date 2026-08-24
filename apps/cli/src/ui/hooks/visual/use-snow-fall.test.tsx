/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSnowfall } from './use-snow-fall.js';
import { themeManager } from '../../theme/manager.js';
import { renderHookWithProviders } from '../../../test-utils/render.js';
import { act } from 'react';
import { debugState } from '../../debug-state.js';
import type { Theme } from '../../theme/core.js';
import type { UIState } from '../../contexts/ui-state-context.js';

vi.mock('../../theme/manager.js', () => ({
  themeManager: {
    getActiveTheme: vi.fn(),
  },
}));

vi.mock('../../theme/presets/holiday.js', () => ({
  Holiday: { name: 'Holiday' },
}));

vi.mock('../terminal/use-terminal-size.js', () => ({
  useTerminalSize: vi.fn(() => ({ columns: 120, rows: 20 })),
}));

describe('useSnowfall', () => {
  const mockArt = 'LOGO';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(themeManager.getActiveTheme).mockReturnValue({
      name: 'Holiday',
    } as Theme);
    vi.setSystemTime(new Date('2025-12-25'));
    debugState.debugNumAnimatedComponents = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially enables animation during holiday season with Holiday theme', () => {
    const { result } = renderHookWithProviders(() => useSnowfall(mockArt, 120), {
      uiState: { history: [], historyRemountKey: 0 } as Partial<UIState>,
    });

    // Should contain holiday trees
    expect(result.current).toContain('|_|');
    // Should have started animation
    expect(debugState.debugNumAnimatedComponents).toBeGreaterThan(0);
  });

  it('stops animation after 15 seconds', () => {
    const { result } = renderHookWithProviders(() => useSnowfall(mockArt, 120), {
      uiState: { history: [], historyRemountKey: 0 } as Partial<UIState>,
    });

    expect(debugState.debugNumAnimatedComponents).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(15001);
    });

    // Animation should be stopped
    expect(debugState.debugNumAnimatedComponents).toBe(0);
    // Should no longer contain trees
    expect(result.current).toBe(mockArt);
  });

  it('does not enable animation if not holiday season', () => {
    vi.setSystemTime(new Date('2025-06-15'));
    const { result } = renderHookWithProviders(() => useSnowfall(mockArt, 120), {
      uiState: { history: [], historyRemountKey: 0 } as Partial<UIState>,
    });

    expect(result.current).toBe(mockArt);
    expect(debugState.debugNumAnimatedComponents).toBe(0);
  });

  it('does not enable animation if theme is not Holiday', () => {
    vi.mocked(themeManager.getActiveTheme).mockReturnValue({
      name: 'Default',
    } as Theme);
    const { result } = renderHookWithProviders(() => useSnowfall(mockArt, 120), {
      uiState: { history: [], historyRemountKey: 0 } as Partial<UIState>,
    });

    expect(result.current).toBe(mockArt);
    expect(debugState.debugNumAnimatedComponents).toBe(0);
  });

  it('does not enable animation if chat has started', () => {
    const { result } = renderHookWithProviders(() => useSnowfall(mockArt, 120), {
      uiState: {
        history: [{ type: 'user', text: 'hello' }],
        historyRemountKey: 0,
      } as Partial<UIState>,
    });

    expect(result.current).toBe(mockArt);
    expect(debugState.debugNumAnimatedComponents).toBe(0);
  });
});
