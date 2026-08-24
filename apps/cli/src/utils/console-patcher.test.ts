/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsolePatcher } from './console-patcher.js';

describe('ConsolePatcher', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
  });

  it('preserves console levels and formats arguments', () => {
    const onNewMessage = vi.fn();
    const patcher = new ConsolePatcher({ debugMode: true, onNewMessage });
    patcher.patch();
    cleanup = patcher.cleanup;

    console.log('ready', { turns: 2 });
    console.info('connected');
    console.warn('slow');
    console.error('failed');
    console.debug('trace', 7);

    expect(onNewMessage.mock.calls.map(([message]) => message.type)).toEqual([
      'log',
      'info',
      'warn',
      'error',
      'debug',
    ]);
    expect(onNewMessage).toHaveBeenLastCalledWith({
      type: 'debug',
      content: 'trace 7',
    });
  });

  it('drops debug messages outside debug mode', () => {
    const onNewMessage = vi.fn();
    const patcher = new ConsolePatcher({ debugMode: false, onNewMessage });
    patcher.patch();
    cleanup = patcher.cleanup;

    console.debug('hidden');
    console.warn('visible');

    expect(onNewMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'warn',
      content: 'visible',
    });
  });

  it('restores the original console methods', () => {
    const originalLog = console.log;
    const patcher = new ConsolePatcher({
      debugMode: true,
      onNewMessage: vi.fn(),
    });

    patcher.patch();
    expect(console.log).not.toBe(originalLog);

    patcher.cleanup();
    expect(console.log).toBe(originalLog);
  });
});
