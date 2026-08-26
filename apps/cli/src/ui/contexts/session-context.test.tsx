/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, type MutableRefObject, type ReactNode } from 'react';
import { act } from 'react';
import { createInitialSessionMetrics } from '../session-metrics.js';
import { describe, expect, it, vi } from 'vitest';
import { render } from '../../test-utils/render.js';
import type {
  ConversationRuntime,
  ConversationSessionStats,
} from '../conversation-runtime.js';
import { SessionStatsProvider, useSessionStats } from './session-context.js';

class ErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.state.hasError ? null : this.props.children;
  }
}

const TestHarness = ({
  contextRef,
}: {
  contextRef: MutableRefObject<ReturnType<typeof useSessionStats> | undefined>;
}) => {
  contextRef.current = useSessionStats();
  return null;
};

function createRuntime() {
  let sessionStats: ConversationSessionStats = {
    sessionId: 'session-1',
    metrics: createInitialSessionMetrics(),
    lastPromptTokenCount: 0,
  };
  const listeners = new Set<() => void>();
  const runtime: ConversationRuntime = {
    getSnapshot: () => ({ messages: [], todos: [], busy: false }),
    getSessionStats: () => sessionStats,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    submit: vi.fn(),
    cancel: vi.fn(),
    exit: vi.fn(),
  };
  return {
    runtime,
    update(next: ConversationSessionStats) {
      sessionStats = next;
      for (const listener of listeners) listener();
    },
  };
}

describe('SessionStatsContext', () => {
  it('projects initial and updated DSH runtime stats', () => {
    const contextRef: MutableRefObject<
      ReturnType<typeof useSessionStats> | undefined
    > = { current: undefined };
    const source = createRuntime();
    const { unmount } = render(
      <SessionStatsProvider conversationRuntime={source.runtime}>
        <TestHarness contextRef={contextRef} />
      </SessionStatsProvider>,
    );

    expect(contextRef.current?.stats.sessionId).toBe('session-1');
    const metrics = createInitialSessionMetrics();
    metrics.models['deepseek'] = {
      requests: 1,
      tokens: {
        inputTokens: 4,
        outputTokens: 3,
        cacheReadTokens: 2,
        cacheWriteTokens: 0,
        reasoningTokens: 1,
        totalTokens: 9,
      },
    };
    act(() => source.update({
      sessionId: 'session-1',
      metrics,
      lastPromptTokenCount: 6,
      contextWindow: 128_000,
    }));
    expect(contextRef.current?.stats.lastPromptTokenCount).toBe(6);
    expect(contextRef.current?.stats.contextWindow).toBe(128_000);
    expect(contextRef.current?.stats.metrics.models['deepseek'].tokens.totalTokens).toBe(9);
    act(() => contextRef.current?.startNewPrompt());
    expect(contextRef.current?.getPromptCount()).toBe(1);
    unmount();
  });

  it('throws outside the provider', () => {
    const onError = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(
      <ErrorBoundary onError={onError}>
        <TestHarness contextRef={{ current: undefined }} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'useSessionStats must be used within a SessionStatsProvider',
    }));
    consoleSpy.mockRestore();
    unmount();
  });
});
