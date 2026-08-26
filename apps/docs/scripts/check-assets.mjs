/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { stat } from 'node:fs/promises';

for (const [relativePath, minimumBytes] of [
  ['../public/favicon.svg', 100],
  ['../public/licenses/OFL-1.1.txt', 4_000],
  ['../public/social-card.png', 10_000],
]) {
  const info = await stat(new URL(relativePath, import.meta.url));
  if (!info.isFile() || info.size < minimumBytes)
    throw new Error(
      `${relativePath} must be a file of at least ${minimumBytes} bytes`,
    );
}

console.log('static_asset_check_ok=true');
