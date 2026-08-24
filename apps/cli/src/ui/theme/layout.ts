/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LoadedSettings } from '../../config/user-settings.js';
import { isAlternateBufferEnabled } from '../hooks/terminal/use-alternate-buffer.js';

/**
 * Standard width threshold for switching between "desktop-like"
 * and "mobile-like" (narrow) layouts in the terminal.
 */
export const NARROW_WIDTH_THRESHOLD = 80;

/**
 * Determines if the given width is considered "narrow".
 * Used to trigger responsive layout adjustments (e.g., hiding sidebars,
 * switching to vertical stacking).
 */
export function isNarrowWidth(width: number): boolean {
  return width < NARROW_WIDTH_THRESHOLD;
}

/**
 * Linearly interpolates between two values.
 *
 * @param start The start value.
 * @param end The end value.
 * @param t The interpolation amount (typically between 0 and 1).
 */
export const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

export const calculateMainAreaWidth = (
  terminalWidth: number,
  settings: LoadedSettings,
): number => {
  if (isAlternateBufferEnabled(settings)) {
    return terminalWidth - 1;
  }
  return terminalWidth;
};
