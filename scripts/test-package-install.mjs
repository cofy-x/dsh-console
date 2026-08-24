/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliDir = join(root, 'apps', 'cli');
const packageName = '@cofy-x/dsh-console';
const packageVersion = '0.1.0-alpha.0';

async function run(command, args, options = {}) {
  const { timeoutMs = 180_000, ...spawnOptions } = options;
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      ...spawnOptions,
      signal: AbortSignal.timeout(timeoutMs),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
}

function assertSucceeded(label, result) {
  assert.equal(
    result.code,
    0,
    `${label} exited ${String(result.code)} (${String(result.signal)})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-console-package-'));
  try {
    const npmUserConfig = join(temporaryRoot, 'npmrc');
    const installRoot = join(temporaryRoot, 'install');
    const dshHome = join(temporaryRoot, '.dsh');
    await writeFile(npmUserConfig, '');
    const cleanNpmEnv = {
      ...process.env,
      NPM_CONFIG_USERCONFIG: npmUserConfig,
    };

    const packed = await run(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['pack', '--json', '--silent', '--pack-destination', temporaryRoot],
      { cwd: cliDir, env: cleanNpmEnv },
    );
    assertSucceeded('npm pack', packed);
    const jsonStart = packed.stdout.lastIndexOf('\n[');
    assert.ok(jsonStart >= 0, `npm pack did not emit JSON:\n${packed.stdout}`);
    const [packResult] = JSON.parse(packed.stdout.slice(jsonStart + 1));
    assert.equal(packResult.name, packageName);
    assert.equal(packResult.version, packageVersion);
    const paths = packResult.files.map((file) => file.path);
    for (const path of paths) {
      assert.ok(
        path === 'LICENSE' ||
          path === 'NOTICE' ||
          path === 'README.md' ||
          path === 'THIRD_PARTY_NOTICES.md' ||
          path === 'bin/dsh-console.js' ||
          path === 'cordis.patch.yml' ||
          path === 'package.json' ||
          path.startsWith('dist/'),
        `unexpected public tarball entry: ${path}`,
      );
      assert.ok(!path.endsWith('.map'), `source map leaked into tarball: ${path}`);
    }
    assert.ok(paths.includes('LICENSE'));
    assert.ok(paths.includes('NOTICE'));
    assert.ok(paths.includes('THIRD_PARTY_NOTICES.md'));
    assert.ok(paths.includes('bin/dsh-console.js'));
    assert.ok(paths.includes('cordis.patch.yml'));
    assert.ok(paths.includes('dist/dsh/index.js'));
    assert.ok(paths.includes('dist/dsh/startup.js'));

    const tarball = join(temporaryRoot, packResult.filename);
    const installed = await run(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        '--prefix',
        installRoot,
        tarball,
      ],
      { cwd: temporaryRoot, env: cleanNpmEnv },
    );
    assertSucceeded('isolated npm install', installed);
    const installedPackageRoot = join(
      installRoot,
      'node_modules',
      '@cofy-x',
      'dsh-console',
    );
    const installedManifest = await readJson(
      join(installedPackageRoot, 'package.json'),
    );
    assert.equal(installedManifest.name, packageName);
    assert.equal(installedManifest.version, packageVersion);

    const sensitiveContentPatterns = [
      /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
      /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
      /\bnpm_[A-Za-z0-9]{36}\b/,
      /\bAKIA[0-9A-Z]{16}\b/,
      /(?:^|\s)(?:_authToken|NPM_TOKEN|NODE_AUTH_TOKEN)\s*[:=]/im,
      /https?:\/\/[^/\s:@]+:[^/\s@]+@/i,
    ];
    for (const path of paths) {
      const content = await readFile(join(installedPackageRoot, path), 'utf8');
      for (const pattern of sensitiveContentPatterns) {
        assert.doesNotMatch(
          content,
          pattern,
          `forbidden public content in ${path}: ${String(pattern)}`,
        );
      }
    }

    const launcher = join(
      installRoot,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'dsh-console.cmd' : 'dsh-console',
    );
    const launched = await run(launcher, ['--dump-config'], {
      cwd: temporaryRoot,
      env: {
        ...cleanNpmEnv,
        PATH: `${join(root, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`,
        DSH_HOME: dshHome,
        DSH_AGENTS_HOME: join(temporaryRoot, '.agents'),
        DSH_CONSOLE_PACKAGE_SPEC: tarball,
        DSH_TELEMETRY_DISABLED: '1',
      },
    });
    assertSucceeded('isolated dsh-console launcher', launched);
    assert.match(launched.stdout, /id: dsh-console-startup/);
    assert.match(launched.stdout, /id: dsh-console-runner/);

    const profileDir = join(dshHome, 'profiles', 'dsh-console');
    const profileManifest = await readJson(join(profileDir, 'package.json'));
    assert.ok(profileManifest.dsh.profile.bundles.includes(packageName));
    const profilePackage = await readJson(
      join(profileDir, 'node_modules', '@cofy-x', 'dsh-console', 'package.json'),
    );
    assert.equal(profilePackage.name, packageName);
    assert.equal(profilePackage.version, packageVersion);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await main();
