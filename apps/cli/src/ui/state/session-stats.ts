/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionMetrics, ComputedSessionStats } from '../contexts/session-context.js';

export const computeSessionStats = (
  metrics: SessionMetrics,
): ComputedSessionStats => {
  const { models, tools } = metrics;
  const totalCacheReadTokens = Object.values(models).reduce(
    (acc, model) => acc + model.tokens.cacheReadTokens,
    0,
  );
  const totalPromptTokens = Object.values(models).reduce(
    (acc, model) =>
      acc +
      model.tokens.inputTokens +
      model.tokens.cacheReadTokens +
      model.tokens.cacheWriteTokens,
    0,
  );
  const cacheEfficiency =
    totalPromptTokens > 0
      ? (totalCacheReadTokens / totalPromptTokens) * 100
      : 0;
  const successRate =
    tools.totalCalls > 0 ? (tools.totalSuccess / tools.totalCalls) * 100 : 0;

  return {
    cacheEfficiency,
    successRate,
    totalCacheReadTokens,
    totalPromptTokens,
  };
};
