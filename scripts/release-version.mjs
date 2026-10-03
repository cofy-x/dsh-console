/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';

const releaseVersion =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-(?:alpha|rc)\.(?:0|[1-9]\d*)$/;

/** Keep local composition checks and both publishing gates on one policy. */
export function assertReleaseVersion(version) {
  assert.equal(typeof version, 'string', 'release version must be a string');
  assert.match(
    version,
    releaseVersion,
    'Console releases must use an alpha or rc prerelease version',
  );
}
