/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { calculateMainAreaWidth, lerp } from './layout.js';
import type { LoadedSettings } from '../../config/user-settings.js';

// Mock dependencies
const mocks = vi.hoisted(() => ({
  isAlternateBufferEnabled: vi.fn(),
}));

vi.mock('../hooks/terminal/use-alternate-buffer.js', () => ({
  isAlternateBufferEnabled: mocks.isAlternateBufferEnabled,
}));

describe('layout', () => {
  describe('lerp', () => {
    it.each([
      [0, 10, 0, 0],
      [0, 10, 1, 10],
      [0, 10, 0.5, 5],
      [10, 20, 0.5, 15],
      [-10, 10, 0.5, 0],
      [0, 10, 2, 20],
      [0, 10, -1, -10],
    ])('lerp(%d, %d, %d) should return %d', (start, end, t, expected) => {
      expect(lerp(start, end, t)).toBe(expected);
    });
  });

  describe('ui-sizing', () => {
    const createSettings = (useFullWidth?: boolean): LoadedSettings =>
      ({
        merged: {
          ui: {
            useFullWidth,
          },
        },
      }) as unknown as LoadedSettings;

    describe('calculateMainAreaWidth', () => {
      it.each([
        // expected, width, altBuffer
        [80, 80, false],
        [100, 100, false],
        [79, 80, true],
        [99, 100, true],
      ])(
        'should return %i when width=%i and altBuffer=%s',
        (expected, width, altBuffer) => {
          mocks.isAlternateBufferEnabled.mockReturnValue(altBuffer);
          const settings = createSettings();

          expect(calculateMainAreaWidth(width, settings)).toBe(expected);
        },
      );
    });
  });
});
