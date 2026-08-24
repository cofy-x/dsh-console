/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Storage, debugLogger } from '@cofy-x/dsh-console-core';
import { PersistentState } from './persistent.js';

vi.mock('node:fs');
vi.mock('@cofy-x/dsh-console-core', () => ({
  Storage: { getGlobalDshConsoleDir: vi.fn() },
  debugLogger: { warn: vi.fn() },
}));

describe('PersistentState', () => {
  let state: PersistentState;
  const directory = '/mock/dir';
  const file = path.join(directory, 'state.json');

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(Storage.getGlobalDshConsoleDir).mockReturnValue(directory);
    state = new PersistentState();
  });

  it('loads a supported key from disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"tipsShown":4}');
    expect(state.get('tipsShown')).toBe(4);
    expect(fs.readFileSync).toHaveBeenCalledWith(file, 'utf-8');
  });

  it('persists supported state', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    state.set('tipsShown', 5);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      file,
      JSON.stringify({ tipsShown: 5 }, null, 2),
    );
  });

  it('falls back safely when loading fails', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('read failed');
    });
    expect(state.get('tipsShown')).toBeUndefined();
    expect(debugLogger.warn).toHaveBeenCalled();
  });
});
