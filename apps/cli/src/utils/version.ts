/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPackageRoot } from './package-root.js';

interface PackageManifest {
  version?: string;
}

export async function getVersion(): Promise<string> {
  if (process.env['DSH_CONSOLE_VERSION']) {
    return process.env['DSH_CONSOLE_VERSION'];
  }

  const manifestPath = join(findPackageRoot(import.meta.url), 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest;
  return manifest.version ?? 'unknown';
}
