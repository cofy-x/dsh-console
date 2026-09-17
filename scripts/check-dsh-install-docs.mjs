/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  await readFile(join(root, 'apps', 'cli', 'package.json'), 'utf8'),
);
const minimum = manifest.dsh?.compatibility?.minimum;
const maximumTested = manifest.dsh?.compatibility?.maximumTested;
assert.equal(typeof minimum, 'string');
assert.equal(typeof maximumTested, 'string');

const exactPair = `npm install --global @deepseek-ai/dsh@${minimum} ${manifest.name}@${manifest.version}`;
const exactDsh = `npm install --global @deepseek-ai/dsh@${minimum}`;
const pairDocuments = [
  'README.md',
  'README.zh.md',
  'apps/cli/README.md',
  'apps/docs/src/content/docs/getting-started/index.md',
  'apps/docs/src/content/docs/zh-cn/getting-started/index.md',
];
const diagnosticDocuments = [
  'apps/docs/src/content/docs/reference/cli.md',
  'apps/docs/src/content/docs/zh-cn/reference/cli.md',
  'apps/docs/src/content/docs/troubleshooting.md',
  'apps/docs/src/content/docs/zh-cn/troubleshooting.md',
];

for (const path of pairDocuments) {
  const content = await readFile(join(root, path), 'utf8');
  assert.ok(content.includes(exactPair), `${path} must include: ${exactPair}`);
  assert.ok(content.includes(minimum), `${path} must name DSH ${minimum}`);
  assert.ok(
    content.includes(maximumTested),
    `${path} must name maximum tested DSH ${maximumTested}`,
  );
}

for (const path of diagnosticDocuments) {
  const content = await readFile(join(root, path), 'utf8');
  assert.ok(content.includes(exactDsh), `${path} must include: ${exactDsh}`);
  assert.ok(content.includes(minimum), `${path} must name DSH ${minimum}`);
  assert.ok(
    content.includes(maximumTested),
    `${path} must name maximum tested DSH ${maximumTested}`,
  );
}
