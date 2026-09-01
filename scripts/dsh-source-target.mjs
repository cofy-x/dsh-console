/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetPath = resolve(root, 'scripts', 'dsh-source-target.json');
const publishManifestPath = resolve(root, 'apps', 'cli', 'package.json');
const versionReferencePaths = [
  'README.md',
  'README.zh.md',
  'apps/cli/README.md',
  'apps/docs/src/content/docs/getting-started/index.md',
  'apps/docs/src/content/docs/zh-cn/getting-started/index.md',
];

export async function loadDshSourceTarget() {
  const target = JSON.parse(await readFile(targetPath, 'utf8'));
  assert.match(
    target.repository,
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    'audited DSH repository must be an owner/repository pair',
  );
  assert.match(
    target.commit,
    /^[0-9a-f]{40}$/,
    'audited DSH commit must be an immutable full SHA',
  );
  assert.match(
    target.version,
    /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/,
    'audited DSH version must be a prerelease semantic version',
  );
  return target;
}

export async function validateDshSourceTarget() {
  const target = await loadDshSourceTarget();
  const publishManifest = JSON.parse(
    await readFile(publishManifestPath, 'utf8'),
  );
  const compatibility = publishManifest.dsh?.compatibility;
  assert.equal(
    compatibility?.maximumTested,
    target.version,
    'Console maximumTested must match the audited DSH source target',
  );

  const expectedPeerRange = `>=${compatibility.minimum} <=${target.version}`;
  const dshPeers = Object.entries(
    publishManifest.peerDependencies ?? {},
  ).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'));
  assert.ok(dshPeers.length > 0, 'Console must declare DSH host peers');
  for (const [name, range] of dshPeers) {
    assert.equal(
      range,
      expectedPeerRange,
      `${name} must stay inside the audited DSH compatibility window`,
    );
    assert.equal(
      publishManifest.peerDependenciesMeta?.[name]?.optional,
      true,
      `${name} must remain a host-provided optional peer`,
    );
  }

  for (const path of versionReferencePaths) {
    const contents = await readFile(resolve(root, path), 'utf8');
    assert.ok(
      contents.includes(target.version),
      `${path} must reference audited DSH ${target.version}`,
    );
  }

  return { target, publishManifest };
}

async function main() {
  const { target } = await validateDshSourceTarget();
  if (process.argv.includes('--github-output')) {
    const output = process.env['GITHUB_OUTPUT'];
    assert.ok(output, 'GITHUB_OUTPUT is required with --github-output');
    await appendFile(
      output,
      `repository=${target.repository}\ncommit=${target.commit}\nversion=${target.version}\n`,
    );
    return;
  }
  console.log(
    `audited DSH target: ${target.repository}@${target.commit} (${target.version})`,
  );
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
