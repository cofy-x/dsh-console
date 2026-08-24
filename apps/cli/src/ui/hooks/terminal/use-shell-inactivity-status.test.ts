/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { renderHook } from '../../../test-utils/render.js';
import { useShellInactivityStatus } from './use-shell-inactivity-status.js';
import { useTurnActivityMonitor } from '../ai/use-turn-activity-monitor.js';
import { StreamingState } from '../../types.js';

vi.mock('../ai/use-turn-activity-monitor.js', () => ({
  useTurnActivityMonitor: vi.fn(),
}));

describe('useShellInactivityStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useTurnActivityMonitor).mockReturnValue({
      operationStartTime: 1000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const defaultProps = {
    activePtyId: 'pty-1',
    lastOutputTime: 1001,
    streamingState: StreamingState.Responding,
    embeddedShellFocused: false,
    isInteractiveShellEnabled: true,
  };

  it('should show action_required status after 30s when output has been produced', async () => {
    const { result } = renderHook(() => useShellInactivityStatus(defaultProps));

    expect(result.current.inactivityStatus).toBe('none');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(result.current.inactivityStatus).toBe('action_required');
  });

  it('should show silent_working status after 60s when no output has been produced (silent)', async () => {
    const { result } = renderHook(() =>
      useShellInactivityStatus({ ...defaultProps, lastOutputTime: 500 }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(result.current.inactivityStatus).toBe('none');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(result.current.inactivityStatus).toBe('silent_working');
  });

});
