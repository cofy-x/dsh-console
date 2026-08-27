/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { resolvePokemonNumber } from './pokemon-selection.js';

describe('resolvePokemonNumber', () => {
  it('prefers the CLI value and normalizes leading zeroes', () => {
    expect(resolvePokemonNumber('0669', '25')).toBe(669);
  });

  it('uses the environment fallback', () => {
    expect(resolvePokemonNumber(undefined, '25')).toBe(25);
  });

  it('preserves random selection when no override is configured', () => {
    expect(resolvePokemonNumber(undefined, undefined)).toBeUndefined();
  });

  it.each(['', '0', '-1', '25.5', 'pikachu'])(
    'rejects invalid values (%s)',
    (value) => {
      expect(() => resolvePokemonNumber(value, undefined)).toThrow(
        '--pokemon must be a positive integer.',
      );
    },
  );
});
