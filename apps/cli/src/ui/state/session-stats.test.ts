/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { createInitialSessionMetrics } from '../session-metrics.js';
import { computeSessionStats } from './session-stats.js';

describe('computeSessionStats', () => {
  it('returns zero rates for an empty DSH session', () => {
    expect(computeSessionStats(createInitialSessionMetrics())).toEqual({
      cacheEfficiency: 0,
      successRate: 0,
      totalUncachedInputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalPromptTokens: 0,
      totalOutputTokens: 0,
      totalReasoningTokens: 0,
      totalSessionTokens: 0,
    });
  });

  it('aggregates canonical token usage across models', () => {
    const metrics = createInitialSessionMetrics();
    metrics.models['deepseek/chat'] = {
      requests: 1,
      tokens: {
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 40,
        cacheWriteTokens: 10,
        reasoningTokens: 5,
        totalTokens: 170,
      },
    };
    metrics.models['deepseek/reasoner'] = {
      requests: 1,
      tokens: {
        inputTokens: 50,
        outputTokens: 10,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 8,
        totalTokens: 60,
      },
    };

    expect(computeSessionStats(metrics)).toMatchObject({
      totalCacheReadTokens: 40,
      totalCacheWriteTokens: 10,
      totalPromptTokens: 200,
      totalUncachedInputTokens: 150,
      totalOutputTokens: 30,
      totalReasoningTokens: 13,
      totalSessionTokens: 230,
      cacheEfficiency: 20,
    });
  });

  it('derives tool success rate from canonical call and result events', () => {
    const metrics = createInitialSessionMetrics();
    metrics.tools.totalCalls = 4;
    metrics.tools.totalSuccess = 3;
    metrics.tools.totalFail = 1;

    expect(computeSessionStats(metrics).successRate).toBe(75);
  });
});
