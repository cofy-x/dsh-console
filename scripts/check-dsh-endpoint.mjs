/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAuditedDshCheckout,
  loadDshSourceTarget,
} from './dsh-source-target.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
assert.ok(
  mode === 'minimum' || mode === 'maximum',
  'usage: node scripts/check-dsh-endpoint.mjs <minimum|maximum>',
);

async function readManifest(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const rootManifest = await readManifest(join(root, 'package.json'));
const cliManifest = await readManifest(
  join(root, 'apps', 'cli', 'package.json'),
);
const compatibility = cliManifest.dsh?.compatibility;
assert.equal(
  typeof compatibility?.minimum,
  'string',
  'dsh.compatibility.minimum must be a version string',
);
assert.equal(
  typeof compatibility?.maximumTested,
  'string',
  'dsh.compatibility.maximumTested must be a version string',
);
const expected =
  mode === 'minimum' ? compatibility.minimum : compatibility.maximumTested;
const target = mode === 'maximum' ? await loadDshSourceTarget() : undefined;
if (target !== undefined) {
  assert.equal(
    expected,
    target.version,
    'maximum DSH endpoint must match the audited source target',
  );
}
const installRoot = await realpath(join(root, 'node_modules'));
let auditedSourceRoot;

const packageNames = new Set(
  [
    ...Object.keys(rootManifest.devDependencies ?? {}),
    ...Object.keys(cliManifest.devDependencies ?? {}),
  ].filter(
    (name) =>
      name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'),
  ),
);
assert.ok(
  packageNames.size > 0,
  'no direct DSH development packages were found',
);

let installations = 0;
for (const name of [...packageNames].sort()) {
  const suffix = name.split('/');
  const candidates = [
    join(root, 'node_modules', ...suffix, 'package.json'),
    join(root, 'apps', 'cli', 'node_modules', ...suffix, 'package.json'),
  ];
  let found = false;
  for (const candidate of candidates) {
    let manifest;
    try {
      manifest = await readManifest(candidate);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    found = true;
    installations += 1;
    assert.equal(
      manifest.version,
      expected,
      `${name} resolved to ${String(manifest.version)} at ${candidate}; expected the ${mode} DSH endpoint ${expected}`,
    );
    assert.equal(manifest.name, name, `${candidate} must contain ${name}`);
    const packageRoot = dirname(await realpath(candidate));
    if (mode === 'minimum') {
      const location = relative(installRoot, packageRoot);
      assert.ok(
        location !== '..' &&
          !location.startsWith(`..${sep}`) &&
          !isAbsolute(location),
        `${name} resolves outside the frozen workspace installation; run the minimum gate in an isolated checkout installed from the frozen lockfile`,
      );
    } else {
      const sourceRoot = await assertAuditedDshCheckout(packageRoot, target);
      auditedSourceRoot ??= sourceRoot;
      assert.equal(
        sourceRoot,
        auditedSourceRoot,
        'all maximum DSH packages must resolve from the same audited checkout',
      );
    }
  }
  assert.ok(found, `${name} is not installed in the workspace or CLI package`);
}

console.log(
  `verified ${mode} DSH endpoint ${expected} across ${installations} direct package installation(s)`,
);
