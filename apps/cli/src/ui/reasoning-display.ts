/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export const REASONING_DISPLAY_MODES = ['auto', 'expanded', 'hidden'] as const;

export type ReasoningDisplayMode = (typeof REASONING_DISPLAY_MODES)[number];

export function normalizeReasoningDisplayMode(value: unknown): ReasoningDisplayMode {
  return REASONING_DISPLAY_MODES.includes(value as ReasoningDisplayMode)
    ? (value as ReasoningDisplayMode)
    : 'auto';
}

export function reasoningDisplayLabel(mode: ReasoningDisplayMode): string {
  switch (mode) {
    case 'auto':
      return 'Auto';
    case 'expanded':
      return 'Always expanded';
    case 'hidden':
      return 'Hidden';
    default:
      return 'Auto';
  }
}
