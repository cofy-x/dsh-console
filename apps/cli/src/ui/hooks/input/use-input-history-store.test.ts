/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { act } from 'react';
import { renderHook } from '../../../test-utils/render.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useInputHistoryStore } from './use-input-history-store.js';
import { debugLogger } from '@cofy-x/dsh-console-core';

describe('useInputHistoryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty input history', () => {
    const { result } = renderHook(() => useInputHistoryStore());

    expect(result.current.inputHistory).toEqual([]);
  });

  it('should add input to history', () => {
    const { result } = renderHook(() => useInputHistoryStore());

    act(() => {
      result.current.addInput('test message 1');
    });

    expect(result.current.inputHistory).toEqual(['test message 1']);

    act(() => {
      result.current.addInput('test message 2');
    });

    expect(result.current.inputHistory).toEqual([
      'test message 1',
      'test message 2',
    ]);
  });

  it('should not add empty or whitespace-only inputs', () => {
    const { result } = renderHook(() => useInputHistoryStore());

    act(() => {
      result.current.addInput('');
    });

    expect(result.current.inputHistory).toEqual([]);

    act(() => {
      result.current.addInput('   ');
    });

    expect(result.current.inputHistory).toEqual([]);
  });

  it('should deduplicate consecutive identical messages', () => {
    const { result } = renderHook(() => useInputHistoryStore());

    act(() => {
      result.current.addInput('test message');
    });

    act(() => {
      result.current.addInput('test message'); // Same as previous
    });

    expect(result.current.inputHistory).toEqual(['test message']);

    act(() => {
      result.current.addInput('different message');
    });

    act(() => {
      result.current.addInput('test message'); // Same as first, but not consecutive
    });

    expect(result.current.inputHistory).toEqual([
      'test message',
      'different message',
      'test message',
    ]);
  });

  it('should initialize from persisted history successfully', async () => {
    const history = {
      read: vi
        .fn()
        .mockResolvedValue(['newest', 'middle', 'oldest']),
    };

    const { result } = renderHook(() => useInputHistoryStore());

    await act(async () => {
      await result.current.initializeFromHistory(history);
    });

    // Should reverse the order to oldest first
    expect(result.current.inputHistory).toEqual(['oldest', 'middle', 'newest']);
    expect(history.read).toHaveBeenCalledTimes(1);
  });

  it('should handle persisted history failure gracefully', async () => {
    const history = {
      read: vi.fn().mockRejectedValue(new Error('History error')),
    };

    const consoleSpy = vi
      .spyOn(debugLogger, 'warn')
      .mockImplementation(() => {});

    const { result } = renderHook(() => useInputHistoryStore());

    await act(async () => {
      await result.current.initializeFromHistory(history);
    });

    expect(result.current.inputHistory).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to initialize prompt history:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('should initialize only once', async () => {
    const history = {
      read: vi
        .fn()
        .mockResolvedValue(['message1', 'message2']),
    };

    const { result } = renderHook(() => useInputHistoryStore());

    // Initialize twice to verify the persisted source is read only once.
    await act(async () => {
      await result.current.initializeFromHistory(history);
    });

    await act(async () => {
      await result.current.initializeFromHistory(history);
    });

    // Should be called only once
    expect(history.read).toHaveBeenCalledTimes(1);
    expect(result.current.inputHistory).toEqual(['message2', 'message1']);
  });

  it('should trim input before adding to history', () => {
    const { result } = renderHook(() => useInputHistoryStore());

    act(() => {
      result.current.addInput('  test message  ');
    });

    expect(result.current.inputHistory).toEqual(['test message']);
  });

  it('preserves input added while persisted history is loading', async () => {
    let resolveHistory: (messages: string[]) => void = () => {};
    const history = {
      read: vi.fn(
        () =>
          new Promise<string[]>((resolve) => {
            resolveHistory = resolve;
          }),
      ),
    };
    const { result } = renderHook(() => useInputHistoryStore());

    let initialization: Promise<void>;
    act(() => {
      initialization = result.current.initializeFromHistory(history);
      result.current.addInput('current');
    });
    await act(async () => {
      resolveHistory(['persisted']);
      await initialization!;
    });

    expect(result.current.inputHistory).toEqual(['persisted', 'current']);
  });

  describe('deduplication logic from previous implementation', () => {
    it('should deduplicate consecutive messages from past sessions during initialization', async () => {
      const history = {
        read: vi
          .fn()
          .mockResolvedValue([
            'message1',
            'message1',
            'message2',
            'message2',
            'message3',
          ]), // newest first with duplicates
      };

      const { result } = renderHook(() => useInputHistoryStore());

      await act(async () => {
        await result.current.initializeFromHistory(history);
      });

      // Should deduplicate consecutive messages and reverse to oldest first
      expect(result.current.inputHistory).toEqual([
        'message3',
        'message2',
        'message1',
      ]);
    });

    it('should deduplicate across session boundaries', async () => {
      const history = {
        read: vi.fn().mockResolvedValue(['old2', 'old1']), // newest first
      };

      const { result } = renderHook(() => useInputHistoryStore());

      // Initialize with past session
      await act(async () => {
        await result.current.initializeFromHistory(history);
      });

      // Add current session inputs
      act(() => {
        result.current.addInput('old2'); // Same as last past session message
      });

      // Should deduplicate across session boundary
      expect(result.current.inputHistory).toEqual(['old1', 'old2']);

      act(() => {
        result.current.addInput('new1');
      });

      expect(result.current.inputHistory).toEqual(['old1', 'old2', 'new1']);
    });

    it('should preserve non-consecutive duplicates', async () => {
      const history = {
        read: vi
          .fn()
          .mockResolvedValue(['message2', 'message1', 'message2']), // newest first with non-consecutive duplicate
      };

      const { result } = renderHook(() => useInputHistoryStore());

      await act(async () => {
        await result.current.initializeFromHistory(history);
      });

      // Non-consecutive duplicates should be preserved
      expect(result.current.inputHistory).toEqual([
        'message2',
        'message1',
        'message2',
      ]);
    });

    it('should handle complex deduplication with current session', () => {
      const { result } = renderHook(() => useInputHistoryStore());

      // Add multiple messages with duplicates
      act(() => {
        result.current.addInput('hello');
      });
      act(() => {
        result.current.addInput('hello'); // consecutive duplicate
      });
      act(() => {
        result.current.addInput('world');
      });
      act(() => {
        result.current.addInput('world'); // consecutive duplicate
      });
      act(() => {
        result.current.addInput('hello'); // non-consecutive duplicate
      });

      // Should have deduplicated consecutive ones
      expect(result.current.inputHistory).toEqual(['hello', 'world', 'hello']);
    });

    it('should maintain oldest-first order in final output', async () => {
      const history = {
        read: vi
          .fn()
          .mockResolvedValue(['newest', 'middle', 'oldest']), // newest first
      };

      const { result } = renderHook(() => useInputHistoryStore());

      await act(async () => {
        await result.current.initializeFromHistory(history);
      });

      // Add current session messages
      act(() => {
        result.current.addInput('current1');
      });
      act(() => {
        result.current.addInput('current2');
      });

      // Should maintain oldest-first order
      expect(result.current.inputHistory).toEqual([
        'oldest',
        'middle',
        'newest',
        'current1',
        'current2',
      ]);
    });
  });
});
