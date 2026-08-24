/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@cofy-x/dsh-console';

export function findPackageRoot(moduleUrl: string): string {
  let directory = dirname(fileURLToPath(moduleUrl));
  const root = parse(directory).root;

  while (directory !== root) {
    const manifestPath = join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        name?: string;
      };
      if (manifest.name === PACKAGE_NAME) return directory;
    }
    directory = dirname(directory);
  }

  throw new Error(`Unable to locate ${PACKAGE_NAME} package root`);
}
