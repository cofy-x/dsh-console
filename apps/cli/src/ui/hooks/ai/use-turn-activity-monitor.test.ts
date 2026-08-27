/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '../../../test-utils/render.js';
import { useTurnActivityMonitor } from './use-turn-activity-monitor.js';
import { StreamingState } from '../../types.js';

describe('useTurnActivityMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should set operationStartTime when entering Responding state', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useTurnActivityMonitor(state, null),
      {
        initialProps: { state: StreamingState.Idle },
      },
    );

    expect(result.current.operationStartTime).toBe(0);

    rerender({ state: StreamingState.Responding });
    expect(result.current.operationStartTime).toBe(1000);
  });

  it('should reset operationStartTime when PTY ID changes while responding', () => {
    const { result, rerender } = renderHook(
      ({ state, ptyId }) => useTurnActivityMonitor(state, ptyId),
      {
        initialProps: {
          state: StreamingState.Responding,
          ptyId: 'pty-1',
        },
      },
    );

    expect(result.current.operationStartTime).toBe(1000);

    vi.setSystemTime(2000);
    rerender({ state: StreamingState.Responding, ptyId: 'pty-2' });
    expect(result.current.operationStartTime).toBe(2000);
  });

  it('should reset everything when idle', () => {
    const { result, rerender } = renderHook(
      ({ state }) => useTurnActivityMonitor(state, 'pty-1'),
      {
        initialProps: { state: StreamingState.Responding },
      },
    );

    expect(result.current.operationStartTime).toBe(1000);

    rerender({ state: StreamingState.Idle });
    expect(result.current.operationStartTime).toBe(0);
  });
});
