/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertReleaseVersion } from './release-version.mjs';

test('accepts supported alpha and release-candidate versions', () => {
  for (const version of ['0.1.0-alpha.0', '0.1.0-alpha.21', '0.1.0-rc.1']) {
    assert.doesNotThrow(() => assertReleaseVersion(version));
  }
});

test('rejects stable releases, unknown channels, and malformed versions', () => {
  for (const version of [
    '0.1.0',
    '0.1.0-beta.1',
    '0.1.0-next.1',
    '0.1.0-rc',
    '0.1.0-rc.01',
    '01.1.0-rc.1',
    '0.1.0-rc.1+build',
    'v0.1.0-rc.1',
    '',
    undefined,
    null,
    1,
  ]) {
    assert.throws(() => assertReleaseVersion(version));
  }
});
