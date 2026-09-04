/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const writeToStdout = vi.hoisted(() => vi.fn());

vi.mock('./stdio.js', () => ({ writeToStdout }));

import {
  disableMouseEvents,
  enableMouseEvents,
  resumeMouseEvents,
} from './modes.js';

describe('mouse terminal modes', () => {
  beforeEach(() => {
    enableMouseEvents('button-motion');
    writeToStdout.mockClear();
  });

  it('enables button-motion tracking with SGR coordinates', () => {
    enableMouseEvents('button-motion');

    expect(writeToStdout).toHaveBeenCalledExactlyOnceWith(
      '\u001b[?1003l\u001b[?1002h\u001b[?1006h',
    );
  });

  it('enables any-motion tracking with SGR coordinates', () => {
    enableMouseEvents('any-motion');

    expect(writeToStdout).toHaveBeenCalledExactlyOnceWith(
      '\u001b[?1002l\u001b[?1003h\u001b[?1006h',
    );
  });

  it('restores the last explicitly requested mode after suspension', () => {
    enableMouseEvents('any-motion');
    disableMouseEvents();
    writeToStdout.mockClear();

    resumeMouseEvents();

    expect(writeToStdout).toHaveBeenCalledWith(
      '\u001b[?1002l\u001b[?1003h\u001b[?1006h',
    );
  });

  it('disables every supported tracking mode', () => {
    disableMouseEvents();

    expect(writeToStdout).toHaveBeenCalledExactlyOnceWith(
      '\u001b[?1006l\u001b[?1003l\u001b[?1002l',
    );
  });
});
