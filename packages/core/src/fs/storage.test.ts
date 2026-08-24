/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';

import { Storage } from './storage.js';
import { DSH_CONSOLE_DIR } from './paths/paths.js';

describe('Storage', () => {
  describe('getGlobalSettingsPath', () => {
    it('returns path to ~/.dsh-console/settings.json', () => {
      const expected = path.join(
        os.homedir(),
        DSH_CONSOLE_DIR,
        'settings.json',
      );
      expect(Storage.getGlobalSettingsPath()).toBe(expected);
    });
  });
});

describe('Storage – additional helpers', () => {
  const projectRoot = '/tmp/project';
  const storage = new Storage(projectRoot);

  it('getWorkspaceSettingsPath returns project/.dsh-console/settings.json', () => {
    const expected = path.join(projectRoot, DSH_CONSOLE_DIR, 'settings.json');
    expect(storage.getWorkspaceSettingsPath()).toBe(expected);
  });
});
