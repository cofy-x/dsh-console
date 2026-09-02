/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export function formatMetricDuration(milliseconds: number): string {
  const seconds = milliseconds / 1_000;
  if (seconds < 60) return `${Number(seconds.toFixed(1))}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function formatTokenRate(tokensPerSecond: number): string {
  return `${Math.round(tokensPerSecond)} tok/s`;
}
