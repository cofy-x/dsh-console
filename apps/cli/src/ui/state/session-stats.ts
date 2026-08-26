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
  const totalUncachedInputTokens = Object.values(models).reduce(
    (acc, model) => acc + model.tokens.inputTokens,
    0,
  );
  const totalCacheReadTokens = Object.values(models).reduce(
    (acc, model) => acc + model.tokens.cacheReadTokens,
    0,
  );
  const totalCacheWriteTokens = Object.values(models).reduce(
    (acc, model) => acc + model.tokens.cacheWriteTokens,
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
  const totalOutputTokens = Object.values(models).reduce(
    (acc, model) => acc + model.tokens.outputTokens,
    0,
  );
  const totalReasoningTokens = Object.values(models).reduce(
    (acc, model) => acc + model.tokens.reasoningTokens,
    0,
  );
  const totalSessionTokens = Object.values(models).reduce(
    (acc, model) => acc + model.tokens.totalTokens,
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
    totalUncachedInputTokens,
    totalCacheReadTokens,
    totalCacheWriteTokens,
    totalPromptTokens,
    totalOutputTokens,
    totalReasoningTokens,
    totalSessionTokens,
  };
};
