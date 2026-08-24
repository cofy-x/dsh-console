/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeTerminalTitle, type TerminalTitleOptions } from './window-title.js';
import { StreamingState } from '../ui/types.js';

const options = (
  overrides: Partial<TerminalTitleOptions> = {},
): TerminalTitleOptions => ({
  streamingState: StreamingState.Idle,
  isConfirming: false,
  isSilentWorking: false,
  folderName: 'my-project',
  useDynamicTitle: true,
  ...overrides,
});

describe('computeTerminalTitle', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [options(), '◇  Ready (my-project)'],
    [options({ streamingState: StreamingState.Responding }), '✦  Working… (my-project)'],
    [options({ isConfirming: true }), '✋  Action Required (my-project)'],
    [options({ isSilentWorking: true }), '⏲  Working… (my-project)'],
  ])('renders canonical runtime state', (input, expected) => {
    const title = computeTerminalTitle(input);
    expect(title).toContain(expected);
    expect(title).toHaveLength(80);
  });

  it('supports a stable non-dynamic title', () => {
    expect(computeTerminalTitle(options({ useDynamicTitle: false }))).toBe(
      'DSH Console (my-project)'.padEnd(80, ' '),
    );
  });

  it('uses CLI_TITLE and truncates context to 80 columns', () => {
    vi.stubEnv('CLI_TITLE', 'A'.repeat(100));
    const title = computeTerminalTitle(options());
    expect(title).toContain('◇  Ready (AAAA');
    expect(title).toContain('…)');
    expect(title).toHaveLength(80);
  });

  it('strips terminal control characters from context', () => {
    const title = computeTerminalTitle(
      options({ folderName: 'Bad\x00 With\x07Control\x1BChars' }),
    );
    expect(title).toContain('Bad WithControlChars');
    // eslint-disable-next-line no-control-regex
    expect(title).not.toMatch(/[\x00-\x1F\x7F]/);
    expect(title).toHaveLength(80);
  });
});
