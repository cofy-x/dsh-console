/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import { getVersion } from './version.js';

describe('getVersion', () => {
  afterEach(() => {
    delete process.env['DSH_CONSOLE_VERSION'];
  });

  it('reads the public CLI package version', async () => {
    await expect(getVersion()).resolves.toBe('0.1.0-alpha.1');
  });

  it('supports a build-time version override', async () => {
    process.env['DSH_CONSOLE_VERSION'] = '1.2.3-test.0';

    await expect(getVersion()).resolves.toBe('1.2.3-test.0');
  });
});
