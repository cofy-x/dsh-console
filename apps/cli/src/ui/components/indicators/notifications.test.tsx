/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, persistentStateMock } from '../../../test-utils/render.js';
import { Notifications } from './notifications.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppContext, type AppState } from '../../contexts/app-context.js';
import { useUIState, type UIState } from '../../contexts/ui-state-context.js';
import { useIsScreenReaderEnabled } from 'ink';

// Mock dependencies
vi.mock('../../contexts/app-context.js');
vi.mock('../../contexts/ui-state-context.js');
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useIsScreenReaderEnabled: vi.fn(),
  };
});
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => '/mock/home',
    },
    homedir: () => '/mock/home',
  };
});

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    default: actual.posix,
  };
});

vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
  return {
    ...actual,
    homedir: () => '/mock/home',
    Storage: {
      ...actual.Storage,
      getGlobalTempDir: () => '/mock/temp',
    },
  };
});

vi.mock('../../../config/user-settings.js', () => ({
  DEFAULT_MODEL_CONFIGS: {},
  LoadedSettings: class {
    constructor() {
      // this.merged = {};
    }
  },
}));

describe('Notifications', () => {
  const mockUseAppContext = vi.mocked(useAppContext);
  const mockUseUIState = vi.mocked(useUIState);
  const mockUseIsScreenReaderEnabled = vi.mocked(useIsScreenReaderEnabled);
  beforeEach(() => {
    vi.clearAllMocks();
    persistentStateMock.reset();
    mockUseAppContext.mockReturnValue({
      startupWarnings: [],
      version: '1.0.0',
    } as AppState);
    mockUseUIState.mockReturnValue({
      initError: null,
      streamingState: 'idle',
    } as unknown as UIState);
    mockUseIsScreenReaderEnabled.mockReturnValue(false);
  });

  it('renders nothing when no notifications', () => {
    const { lastFrame } = render(<Notifications />);
    expect(lastFrame()).toBe('');
  });

  it.each([[['Warning 1']], [['Warning 1', 'Warning 2']]])(
    'renders startup warnings: %s',
    (warnings) => {
      mockUseAppContext.mockReturnValue({
        startupWarnings: warnings,
        version: '1.0.0',
      } as AppState);
      const { lastFrame } = render(<Notifications />);
      const output = lastFrame();
      warnings.forEach((warning) => {
        expect(output).toContain(warning);
      });
    },
  );

  it('renders init error', () => {
    mockUseUIState.mockReturnValue({
      initError: 'Something went wrong',
      streamingState: 'idle',
    } as unknown as UIState);
    const { lastFrame } = render(<Notifications />);
    expect(lastFrame()).toMatchSnapshot();
  });

  it('does not render init error when streaming', () => {
    mockUseUIState.mockReturnValue({
      initError: 'Something went wrong',
      streamingState: 'responding',
    } as unknown as UIState);
    const { lastFrame } = render(<Notifications />);
    expect(lastFrame()).toBe('');
  });

  it('renders screen reader nudge when enabled and not seen', () => {
    mockUseIsScreenReaderEnabled.mockReturnValue(true);
    persistentStateMock.setData({ hasSeenScreenReaderNudge: false });

    const { lastFrame } = render(<Notifications />);

    expect(lastFrame()).toContain('screen reader-friendly view');
    expect(persistentStateMock.set).toHaveBeenCalledWith(
      'hasSeenScreenReaderNudge',
      true,
    );

    expect(lastFrame()).toMatchSnapshot();
  });

  it('does not render screen reader nudge when already seen in persistent state', () => {
    mockUseIsScreenReaderEnabled.mockReturnValue(true);
    persistentStateMock.setData({ hasSeenScreenReaderNudge: true });

    const { lastFrame } = render(<Notifications />);

    expect(lastFrame()).toBe('');
    expect(persistentStateMock.set).not.toHaveBeenCalled();
  });
});
