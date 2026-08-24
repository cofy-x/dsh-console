/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render } from '../../../test-utils/render.js';
import { useLoadingIndicator } from './use-loading-indicator.js';
import { StreamingState } from '../../types.js';
import {
  PHRASE_CHANGE_INTERVAL_MS,
  INTERACTIVE_SHELL_WAITING_PHRASE,
} from './use-phrase-cycler.js';
import {
  INFORMATIVE_TIPS,
  WITTY_LOADING_PHRASES,
} from '../../components/indicators/loading-phrases.js';

describe('useLoadingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers after each test
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(() => vi.runOnlyPendingTimers);
    vi.restoreAllMocks();
  });

  const renderLoadingIndicatorHook = (
    initialStreamingState: StreamingState,
    initialShouldShowFocusHint: boolean = false,
    customWittyPhrases?: string[],
  ) => {
    let hookResult: ReturnType<typeof useLoadingIndicator>;
    function TestComponent({
      streamingState,
      shouldShowFocusHint,
      customWittyPhrases,
    }: {
      streamingState: StreamingState;
      shouldShowFocusHint?: boolean;
      customWittyPhrases?: string[];
    }) {
      hookResult = useLoadingIndicator({
        streamingState,
        shouldShowFocusHint: !!shouldShowFocusHint,
        customWittyPhrases,
      });
      return null;
    }
    const { rerender } = render(
      <TestComponent
        streamingState={initialStreamingState}
        shouldShowFocusHint={initialShouldShowFocusHint}
        customWittyPhrases={customWittyPhrases}
      />,
    );
    return {
      result: {
        get current() {
          return hookResult;
        },
      },
      rerender: (newProps: {
        streamingState: StreamingState;
        shouldShowFocusHint?: boolean;
        customWittyPhrases?: string[];
      }) => rerender(<TestComponent {...newProps} />),
    };
  };

  it('should initialize with default values when Idle', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => 0.5); // Always witty
    const { result } = renderLoadingIndicatorHook(StreamingState.Idle);
    expect(result.current.elapsedTime).toBe(0);
    expect(WITTY_LOADING_PHRASES).toContain(
      result.current.currentLoadingPhrase,
    );
  });

  it('should show interactive shell waiting phrase when shouldShowFocusHint is true', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => 0.5); // Always witty
    const { result, rerender } = renderLoadingIndicatorHook(
      StreamingState.Responding,
      false,
    );

    // Initially should be witty phrase or tip
    expect([...WITTY_LOADING_PHRASES, ...INFORMATIVE_TIPS]).toContain(
      result.current.currentLoadingPhrase,
    );

    await act(async () => {
      rerender({
        streamingState: StreamingState.Responding,
        shouldShowFocusHint: true,
      });
    });

    expect(result.current.currentLoadingPhrase).toBe(
      INTERACTIVE_SHELL_WAITING_PHRASE,
    );
  });

  it('should reflect values when Responding', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => 0.5); // Always witty for subsequent phrases
    const { result } = renderLoadingIndicatorHook(StreamingState.Responding);

    // Initial phrase on first activation will be a tip, not necessarily from witty phrases
    expect(result.current.elapsedTime).toBe(0);
    // On first activation, it may show a tip, so we can't guarantee it's in WITTY_LOADING_PHRASES

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PHRASE_CHANGE_INTERVAL_MS + 1);
    });

    // Phrase should cycle if PHRASE_CHANGE_INTERVAL_MS has passed, now it should be witty since first activation already happened
    expect(WITTY_LOADING_PHRASES).toContain(
      result.current.currentLoadingPhrase,
    );
  });

  it('uses custom loading phrases supplied by settings', () => {
    const { result } = renderLoadingIndicatorHook(
      StreamingState.Responding,
      false,
      ['DSH is working'],
    );

    expect(result.current.currentLoadingPhrase).toBe('DSH is working');
  });


  it('should reset timer and phrase when streamingState changes from Responding to Idle', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => 0.5); // Always witty
    const { result, rerender } = renderLoadingIndicatorHook(
      StreamingState.Responding,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000); // 10s
    });
    expect(result.current.elapsedTime).toBe(10);

    act(() => {
      rerender({ streamingState: StreamingState.Idle });
    });

    expect(result.current.elapsedTime).toBe(0);
    expect(WITTY_LOADING_PHRASES).toContain(
      result.current.currentLoadingPhrase,
    );

    // Timer should not advance
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.elapsedTime).toBe(0);
  });

});
