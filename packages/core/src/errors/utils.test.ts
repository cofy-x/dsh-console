/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getErrorMessage, isNodeError } from './utils.js';

describe('error utilities', () => {
  describe('isNodeError', () => {
    it('recognizes errors with a Node.js error code', () => {
      const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
      expect(isNodeError(error)).toBe(true);
    });

    it('rejects values without an error code', () => {
      expect(isNodeError(new Error('plain'))).toBe(false);
      expect(isNodeError({ code: 'ENOENT' })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('returns Error messages', () => {
      expect(getErrorMessage(new Error('failed'))).toBe('failed');
    });

    it('safely stringifies non-Error values', () => {
      expect(getErrorMessage('failed')).toBe('failed');
      expect(getErrorMessage(42)).toBe('42');
    });

    it('handles values that cannot be stringified', () => {
      const value = {
        [Symbol.toPrimitive]() {
          throw new Error('cannot stringify');
        },
      };
      expect(getErrorMessage(value)).toBe('Failed to get error details');
    });
  });
});
