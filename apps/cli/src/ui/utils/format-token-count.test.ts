/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { formatTokenCount } from './format-token-count.js';

describe('formatTokenCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1k'],
    [13_200, '13.2k'],
    [128_000, '128k'],
    [1_000_000, '1m'],
    [1_500_000, '1.5m'],
  ])('formats %i tokens as %s', (tokens, expected) => {
    expect(formatTokenCount(tokens)).toBe(expected);
  });
});
