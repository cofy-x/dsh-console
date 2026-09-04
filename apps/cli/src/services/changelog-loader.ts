/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findPackageRoot } from '../utils/package-root.js';

export function loadChangelog(): Promise<string> {
  return readFile(
    join(findPackageRoot(import.meta.url), 'dist', 'CHANGELOG.md'),
    'utf8',
  );
}
