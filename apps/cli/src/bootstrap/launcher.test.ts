/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];
const packageRoot = resolve('.');
const packageVersion = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
).version as string;

function runLauncher(
  exitCodes: number[],
  args: string[] = [],
  options: {
    installedVersion?: string;
    launcherMode?: 'published' | 'source';
    packageSpec?: string;
  } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-console-launcher-'));
  temporaryDirectories.push(root);
  const dshHome = join(root, 'home');
  const fakeBin = join(root, 'bin');
  const counter = join(root, 'count');
  const receivedArgs = join(root, 'args.json');
  const launcherMode = options.launcherMode ?? 'source';
  let launcherRoot = packageRoot;
  if (launcherMode === 'published') {
    const fixtureRoot = join(packageRoot, 'node_modules', '.cache');
    mkdirSync(fixtureRoot, { recursive: true });
    launcherRoot = mkdtempSync(
      join(fixtureRoot, 'dsh-console-published-launcher-'),
    );
    temporaryDirectories.push(launcherRoot);
    mkdirSync(join(launcherRoot, 'bin'), { recursive: true });
    copyFileSync(
      join(packageRoot, 'bin', 'dsh-console.js'),
      join(launcherRoot, 'bin', 'dsh-console.js'),
    );
    writeFileSync(
      join(launcherRoot, 'package.json'),
      JSON.stringify({
        name: '@cofy-x/dsh-console',
        type: 'module',
        version: packageVersion,
      }),
    );
  }
  const installedManifest = join(
    dshHome,
    'profiles',
    'dsh-console',
    'node_modules',
    '@cofy-x',
    'dsh-console',
    'package.json',
  );
  const installedPackageRoot = dirname(installedManifest);
  mkdirSync(dirname(installedPackageRoot), { recursive: true });
  if (launcherMode === 'source' && options.installedVersion === undefined) {
    symlinkSync(
      packageRoot,
      installedPackageRoot,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  } else {
    mkdirSync(installedPackageRoot, { recursive: true });
    writeFileSync(
      installedManifest,
      JSON.stringify({
        name: '@cofy-x/dsh-console',
        version: options.installedVersion ?? packageVersion,
      }),
    );
  }
  writeFileSync(
    join(dshHome, 'profiles', 'dsh-console', 'package.json'),
    JSON.stringify({
      dependencies: {
        '@cofy-x/dsh-console':
          launcherMode === 'source' && options.installedVersion === undefined
            ? `link:${packageRoot}`
            : (options.installedVersion ?? packageVersion),
      },
    }),
  );
  mkdirSync(fakeBin, { recursive: true });
  const fakeScript = join(fakeBin, 'fake-dsh.cjs');
  writeFileSync(
    fakeScript,
    `
const fs = require('node:fs');
const countFile = process.env.DSH_CONSOLE_TEST_COUNT;
const count = fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) + 1 : 1;
fs.writeFileSync(countFile, String(count));
const argsFile = process.env.DSH_CONSOLE_TEST_ARGS;
const calls = fs.existsSync(argsFile) ? JSON.parse(fs.readFileSync(argsFile, 'utf8')) : [];
calls.push(process.argv.slice(2));
fs.writeFileSync(argsFile, JSON.stringify(calls));
const codes = JSON.parse(process.env.DSH_CONSOLE_TEST_CODES);
process.exit(codes[Math.min(count - 1, codes.length - 1)]);
`,
  );
  if (process.platform === 'win32') {
    writeFileSync(
      join(fakeBin, 'dsh.cmd'),
      `@echo off\r\n"${process.execPath}" "${fakeScript}" %*\r\n`,
    );
  } else {
    const fakeDsh = join(fakeBin, 'dsh');
    writeFileSync(
      fakeDsh,
      `#!/usr/bin/env node\nrequire(${JSON.stringify(fakeScript)});\n`,
    );
    chmodSync(fakeDsh, 0o755);
  }

  const result = spawnSync(
    process.execPath,
    [join(launcherRoot, 'bin', 'dsh-console.js'), ...args],
    {
      env: {
        ...process.env,
        DSH_HOME: dshHome,
        DSH_CONSOLE_TEST_COUNT: counter,
        DSH_CONSOLE_TEST_ARGS: receivedArgs,
        DSH_CONSOLE_TEST_CODES: JSON.stringify(exitCodes),
        ...(options.packageSpec === undefined
          ? {}
          : { DSH_CONSOLE_PACKAGE_SPEC: options.packageSpec }),
        PATH: `${fakeBin}${delimiter}${process.env['PATH'] ?? ''}`,
      },
    },
  );

  if (!existsSync(counter) || !existsSync(receivedArgs)) {
    const error = result.error?.message ?? '';
    const stderr = result.stderr?.toString().trim() ?? '';
    throw new Error(
      [
        `Launcher exited before invoking dsh (status ${String(result.status)}).`,
        error,
        stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return {
    result,
    count: Number(readFileSync(counter, 'utf8')),
    receivedCalls: JSON.parse(readFileSync(receivedArgs, 'utf8')) as string[][],
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('dsh-console launcher', () => {
  it('restarts the profile after the reserved restart exit code', () => {
    const { result, count } = runLauncher([199, 0]);
    expect(result.status).toBe(0);
    expect(count).toBe(2);
  });

  it('returns ordinary exit codes without restarting', () => {
    const { result, count } = runLauncher([7]);
    expect(result.status).toBe(7);
    expect(count).toBe(1);
  });

  it('removes a package-manager separator before forwarding CLI options', () => {
    const { result, receivedCalls } = runLauncher([0], ['--', '--debug']);

    expect(result.status).toBe(0);
    expect(receivedCalls).toEqual([['--profile', 'dsh-console', '--debug']]);
  });

  it('reconciles a stale profile before launching it', () => {
    const { result, receivedCalls } = runLauncher([0, 0], [], {
      installedVersion: '0.1.0-alpha.0',
    });

    expect(result.status).toBe(0);
    expect(receivedCalls).toEqual([
      ['plugin', '--profile', 'dsh-console', 'add', packageRoot],
      ['--profile', 'dsh-console'],
    ]);
  });

  it('reconciles a stale published profile to the exact launcher version', () => {
    const { result, receivedCalls } = runLauncher([0, 0], [], {
      installedVersion: '0.1.0-alpha.0',
      launcherMode: 'published',
    });

    expect(result.status).toBe(0);
    expect(receivedCalls).toEqual([
      [
        'plugin',
        '--profile',
        'dsh-console',
        'add',
        `@cofy-x/dsh-console@${packageVersion}`,
      ],
      ['--profile', 'dsh-console'],
    ]);
  });

  it('does not reinstall an aligned published profile', () => {
    const { result, receivedCalls } = runLauncher([0], [], {
      launcherMode: 'published',
    });

    expect(result.status).toBe(0);
    expect(receivedCalls).toEqual([['--profile', 'dsh-console']]);
  });

  it('does not launch a stale profile when reconciliation fails', () => {
    const { result, receivedCalls } = runLauncher([7], [], {
      installedVersion: '0.1.0-alpha.0',
      launcherMode: 'published',
    });

    expect(result.status).toBe(7);
    expect(receivedCalls).toHaveLength(1);
    expect(receivedCalls[0]).toEqual([
      'plugin',
      '--profile',
      'dsh-console',
      'add',
      `@cofy-x/dsh-console@${packageVersion}`,
    ]);
  });

  it('gives an explicit package spec precedence over an existing profile', () => {
    const packageSpec = `@cofy-x/dsh-console@${packageVersion}`;
    const { result, receivedCalls } = runLauncher([0, 0], [], {
      packageSpec,
    });

    expect(result.status).toBe(0);
    expect(receivedCalls).toEqual([
      ['plugin', '--profile', 'dsh-console', 'add', packageSpec],
      ['--profile', 'dsh-console'],
    ]);
  });
});
