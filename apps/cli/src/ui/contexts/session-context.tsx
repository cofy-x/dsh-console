/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ModelMetrics, SessionMetrics } from '../session-metrics.js';
import type { ConversationRuntime } from '../conversation-runtime.js';

export type { ModelMetrics, SessionMetrics };

export interface SessionStatsState {
  sessionId: string;
  sessionStartTime: Date;
  metrics: SessionMetrics;
  lastPromptTokenCount: number;
  contextWindow?: number;
  promptCount: number;
}

export interface ComputedSessionStats {
  cacheEfficiency: number;
  successRate: number;
  totalUncachedInputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalPromptTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalSessionTokens: number;
}

interface SessionStatsContextValue {
  stats: SessionStatsState;
  startNewPrompt: () => void;
  getPromptCount: () => number;
}

const SessionStatsContext = createContext<SessionStatsContextValue | undefined>(
  undefined,
);

export const SessionStatsProvider: React.FC<{
  children: React.ReactNode;
  conversationRuntime: ConversationRuntime;
}> = ({ children, conversationRuntime }) => {
  const initial = conversationRuntime.getSessionStats();
  const [stats, setStats] = useState<SessionStatsState>({
    ...initial,
    sessionStartTime: new Date(),
    promptCount: 0,
  });

  useEffect(() => {
    const update = () => {
      const next = conversationRuntime.getSessionStats();
      setStats((current) => ({ ...current, ...next }));
    };
    const unsubscribe = conversationRuntime.subscribe(update);
    update();
    return unsubscribe;
  }, [conversationRuntime]);

  const startNewPrompt = useCallback(() => {
    setStats((current) => ({
      ...current,
      promptCount: current.promptCount + 1,
    }));
  }, []);

  const getPromptCount = useCallback(
    () => stats.promptCount,
    [stats.promptCount],
  );

  const value = useMemo(
    () => ({ stats, startNewPrompt, getPromptCount }),
    [stats, startNewPrompt, getPromptCount],
  );

  return (
    <SessionStatsContext.Provider value={value}>
      {children}
    </SessionStatsContext.Provider>
  );
};

export const useSessionStats = () => {
  const context = useContext(SessionStatsContext);
  if (context === undefined) {
    throw new Error(
      'useSessionStats must be used within a SessionStatsProvider',
    );
  }
  return context;
};
