/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

/** TUI-owned presentation state derived from canonical DSH events. */
export interface ToolCallStats {
  count: number;
  success: number;
  fail: number;
}

export interface ModelMetrics {
  requests: number;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  };
}

export interface SessionMetrics {
  models: Record<string, ModelMetrics>;
  tools: {
    totalCalls: number;
    totalSuccess: number;
    totalFail: number;
    byName: Record<string, ToolCallStats>;
  };
}

export const createInitialModelMetrics = (): ModelMetrics => ({
  requests: 0,
  tokens: {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  },
});

export const createInitialToolCallStats = (): ToolCallStats => ({
  count: 0,
  success: 0,
  fail: 0,
});

export const createInitialSessionMetrics = (): SessionMetrics => ({
  models: {},
  tools: {
    totalCalls: 0,
    totalSuccess: 0,
    totalFail: 0,
    byName: {},
  },
});
