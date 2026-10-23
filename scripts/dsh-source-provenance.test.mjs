/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptsRoot = dirname(fileURLToPath(import.meta.url));
const version = '0.2.1-rc.2';

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

async function writeJson(path, value) {
  await write(path, JSON.stringify(value));
}

function git(root, ...args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function fixture(t, { built = true } = {}) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-provenance-'));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const root = join(temporaryRoot, 'console');
  const source = join(temporaryRoot, 'harness');
  const dsh = join(source, 'apps', 'cli');
  const agent = join(source, 'packages', 'core', 'agent');
  await writeJson(join(source, 'package.json'), { private: true });
  await write(join(source, '.gitignore'), 'node_modules/\nlib/\n');
  await writeJson(join(dsh, 'package.json'), {
    name: '@deepseek-ai/dsh',
    version,
  });
  await writeJson(join(agent, 'package.json'), {
    name: '@deepseek-ai/dsh-agent',
    version,
  });
  if (built) await write(join(dsh, 'lib', 'bin.js'), '');
  git(source, 'init', '--quiet');
  git(source, 'add', '.');
  git(
    source,
    '-c',
    'user.name=Console Test',
    '-c',
    'user.email=console-test@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  );
  const commit = git(source, 'rev-parse', 'HEAD');
  const target = {
    repository: 'deepseek-ai/DeepSeek-Harness',
    commit,
    version,
  };
  await writeJson(join(root, 'package.json'), {
    private: true,
    devDependencies: {
      '@deepseek-ai/dsh': version,
      '@deepseek-ai/dsh-agent': version,
    },
  });
  await writeJson(join(root, 'apps', 'cli', 'package.json'), {
    dsh: { compatibility: { minimum: version, maximumTested: version } },
    peerDependencies: { '@deepseek-ai/dsh-agent': version },
    peerDependenciesMeta: { '@deepseek-ai/dsh-agent': { optional: true } },
  });
  await writeJson(join(root, 'scripts', 'dsh-source-target.json'), target);
  for (const name of [
    'check-dsh-endpoint.mjs',
    'dsh-source-target.mjs',
    'use-dsh-source.mjs',
  ]) {
    await copyFile(join(scriptsRoot, name), join(root, 'scripts', name));
  }
  for (const path of [
    'README.md',
    'README.zh.md',
    'apps/cli/README.md',
    'apps/docs/src/content/docs/getting-started/index.md',
    'apps/docs/src/content/docs/zh-cn/getting-started/index.md',
  ]) {
    await write(join(root, path), version);
  }
  for (const [name, sourcePackage] of [
    ['dsh', dsh],
    ['dsh-agent', agent],
  ]) {
    const installed = join(root, 'node_modules', '.pnpm', name);
    await writeJson(
      join(installed, 'package.json'),
      JSON.parse(await readFile(join(sourcePackage, 'package.json'), 'utf8')),
    );
    const destination = join(root, 'node_modules', '@deepseek-ai', name);
    await mkdir(dirname(destination), { recursive: true });
    await symlink(
      installed,
      destination,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
  await mkdir(join(root, 'node_modules', '.bin'), { recursive: true });
  const run = (script, ...args) =>
    spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
      cwd: root,
      encoding: 'utf8',
    });
  const installedDsh = join(root, 'node_modules', '@deepseek-ai', 'dsh');
  return { root, source, dsh, commit, installedDsh, run };
}

test('minimum accepts the workspace registry installation and maximum rejects it', async (t) => {
  const { run } = await fixture(t);
  const minimum = run('check-dsh-endpoint.mjs', 'minimum');
  assert.equal(minimum.status, 0, minimum.stderr);
  const maximum = run('check-dsh-endpoint.mjs', 'maximum');
  assert.notEqual(maximum.status, 0);
});

test('the audited source is accepted only as the maximum endpoint', async (t) => {
  const { dsh, installedDsh, source, run } = await fixture(t);
  const selected = run('use-dsh-source.mjs', source);
  assert.equal(selected.status, 0, selected.stderr);
  assert.equal(await realpath(installedDsh), await realpath(dsh));
  const maximum = run('check-dsh-endpoint.mjs', 'maximum');
  assert.equal(maximum.status, 0, maximum.stderr);
  const minimum = run('check-dsh-endpoint.mjs', 'minimum');
  assert.notEqual(minimum.status, 0);
  assert.match(minimum.stderr, /outside the frozen workspace installation/);
});

test('source selection rejects another commit with the same package versions before changing links', async (t) => {
  const { source, installedDsh, run } = await fixture(t);
  const previous = await realpath(installedDsh);
  git(
    source,
    '-c',
    'user.name=Console Test',
    '-c',
    'user.email=console-test@example.invalid',
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'another commit',
  );
  const result = run('use-dsh-source.mjs', source);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be at audited commit/);
  assert.equal(await realpath(installedDsh), previous);
});

test('source selection rejects tracked and untracked source changes before changing links', async (t) => {
  const { source, installedDsh, run } = await fixture(t);
  const previous = await realpath(installedDsh);
  for (const path of ['package.json', 'untracked.ts']) {
    await write(join(source, path), '// changed\n');
    const result = run('use-dsh-source.mjs', source);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must have no tracked or untracked changes/);
    assert.equal(await realpath(installedDsh), previous);
    if (path === 'package.json') git(source, 'restore', path);
  }
});

test('the maximum endpoint rechecks source identity after source selection', async (t) => {
  const { source, run } = await fixture(t);
  const selected = run('use-dsh-source.mjs', source);
  assert.equal(selected.status, 0, selected.stderr);
  await write(join(source, 'untracked.ts'), '// changed\n');
  const result = run('check-dsh-endpoint.mjs', 'maximum');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must have no tracked or untracked changes/);
});

test('the maximum endpoint rejects registry packages inside the audited checkout', async (t) => {
  const { source, installedDsh, run } = await fixture(t);
  const registryPackage = join(source, 'node_modules', '@deepseek-ai', 'dsh');
  await writeJson(join(registryPackage, 'package.json'), {
    name: '@deepseek-ai/dsh',
    version,
  });
  await rm(installedDsh, { recursive: true, force: true });
  await symlink(
    registryPackage,
    installedDsh,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const result = run('check-dsh-endpoint.mjs', 'maximum');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /package.json.*did not match any file/);
});

test('source selection rejects an unbuilt checkout before changing links', async (t) => {
  const { source, installedDsh, run } = await fixture(t, { built: false });
  const previous = await realpath(installedDsh);
  const result = run('use-dsh-source.mjs', source);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Build the audited DSH source runtime/);
  assert.equal(await realpath(installedDsh), previous);
});
