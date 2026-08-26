/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) return String(tokens);
  const divisor = tokens < 1_000_000 ? 1_000 : 1_000_000;
  const suffix = divisor === 1_000 ? 'k' : 'm';
  const value = tokens / divisor;
  const fractionDigits = value < 100 && !Number.isInteger(value) ? 1 : 0;
  return `${value.toFixed(fractionDigits)}${suffix}`;
}
