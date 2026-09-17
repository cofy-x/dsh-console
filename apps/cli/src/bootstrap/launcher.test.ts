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
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import semver from 'semver';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];
const LAUNCHER_TEST_TIMEOUT_MS = 15_000;
const packageRoot = resolve('.');
const packageManifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as {
  dsh: { compatibility: { maximumTested: string; minimum: string } };
  version: string;
};
const packageVersion = packageManifest.version;
const compatibility = packageManifest.dsh.compatibility;
const versionBelowMinimum = '0.0.0-0';
const versionAboveMaximum = semver.inc(compatibility.maximumTested, 'patch')!;

function runLauncher(
  exitCodes: number[],
  args: string[] = [],
  options: {
    dshVersion?: string;
    includeDsh?: boolean;
    installedVersion?: string;
    launcherMode?: 'published' | 'source';
    packageSpec?: string;
    runtimeSignal?: NodeJS.Signals;
    versionExitCode?: number;
    versionOutput?: string;
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
        dsh: packageManifest.dsh,
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
const argsFile = process.env.DSH_CONSOLE_TEST_ARGS;
const calls = fs.existsSync(argsFile) ? JSON.parse(fs.readFileSync(argsFile, 'utf8')) : [];
const args = process.argv.slice(2);
calls.push(args);
fs.writeFileSync(argsFile, JSON.stringify(calls));
if (args.length === 1 && args[0] === '--version') {
  process.stdout.write(process.env.DSH_CONSOLE_TEST_VERSION_OUTPUT);
  process.exit(Number(process.env.DSH_CONSOLE_TEST_VERSION_EXIT));
}
if (process.env.DSH_CONSOLE_TEST_SIGNAL) {
  process.kill(process.pid, process.env.DSH_CONSOLE_TEST_SIGNAL);
}
const countFile = process.env.DSH_CONSOLE_TEST_COUNT;
const count = fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) + 1 : 1;
fs.writeFileSync(countFile, String(count));
const codes = JSON.parse(process.env.DSH_CONSOLE_TEST_CODES);
process.exit(codes[Math.min(count - 1, codes.length - 1)]);
`,
  );
  let fakeDsh = join(fakeBin, 'dsh');
  if (options.includeDsh !== false) {
    if (process.platform === 'win32') {
      fakeDsh = join(fakeBin, 'dsh.cmd');
      writeFileSync(
        fakeDsh,
        `@echo off\r\n"${process.execPath}" "${fakeScript}" %*\r\n`,
      );
    } else {
      writeFileSync(
        fakeDsh,
        `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fakeScript)} "$@"\n`,
      );
      chmodSync(fakeDsh, 0o755);
    }
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
        DSH_CONSOLE_TEST_SIGNAL: options.runtimeSignal ?? '',
        DSH_CONSOLE_TEST_VERSION_EXIT: String(options.versionExitCode ?? 0),
        DSH_CONSOLE_TEST_VERSION_OUTPUT:
          options.versionOutput ??
          `${options.dshVersion ?? compatibility.minimum}\n`,
        ...(options.packageSpec === undefined
          ? {}
          : { DSH_CONSOLE_PACKAGE_SPEC: options.packageSpec }),
        PATH: fakeBin,
      },
    },
  );

  return {
    dshExecutable: fakeDsh,
    result,
    count: existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0,
    receivedCalls: existsSync(receivedArgs)
      ? (JSON.parse(readFileSync(receivedArgs, 'utf8')) as string[][])
      : [],
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('dsh-console launcher', { timeout: LAUNCHER_TEST_TIMEOUT_MS }, () => {
  it('fails before profile mutation when dsh is missing from PATH', () => {
    const { result, count, receivedCalls } = runLauncher([0], [], {
      includeDsh: false,
      installedVersion: '0.1.0-alpha.0',
    });
    expect(result.status).toBe(1);
    expect(count).toBe(0);
    expect(receivedCalls).toEqual([]);
    expect(result.stderr.toString()).toContain('dsh was not found');
    expect(result.stderr.toString()).toContain(
      `npm install --global @deepseek-ai/dsh@${compatibility.minimum}`,
    );
  });

  it('fails before profile mutation when dsh is below the minimum', () => {
    const { dshExecutable, result, count, receivedCalls } = runLauncher(
      [0],
      [],
      {
        dshVersion: versionBelowMinimum,
        installedVersion: '0.1.0-alpha.0',
      },
    );
    const stderr = result.stderr.toString();
    expect(result.status).toBe(1);
    expect(count).toBe(0);
    expect(receivedCalls).toEqual([['--version']]);
    expect(stderr).toContain(dshExecutable);
    expect(stderr).toContain(`Detected version: ${versionBelowMinimum}`);
    expect(stderr).toContain(
      `Minimum supported version: ${compatibility.minimum}`,
    );
  });

  it('launches when dsh equals the minimum', () => {
    const { result, receivedCalls } = runLauncher([0], [], {
      dshVersion: compatibility.minimum,
    });
    expect(result.status).toBe(0);
    expect(receivedCalls).toEqual([
      ['--version'],
      ['--profile', 'dsh-console'],
    ]);
  });

  it('launches when dsh is within the audited range', () => {
    const { result } = runLauncher([0], [], {
      dshVersion: compatibility.maximumTested,
    });
    expect(result.status).toBe(0);
  });

  it('warns without blocking above the maximum tested version', () => {
    const { result, receivedCalls } = runLauncher([0], [], {
      dshVersion: versionAboveMaximum,
    });
    expect(result.status).toBe(0);
    expect(result.stderr.toString()).toContain(
      `newer than the maximum tested version ${compatibility.maximumTested}`,
    );
    expect(receivedCalls.at(-1)).toEqual(['--profile', 'dsh-console']);
  });

  it('fails before profile mutation for invalid version output', () => {
    const { result, count, receivedCalls } = runLauncher([0], [], {
      installedVersion: '0.1.0-alpha.0',
      versionOutput: 'DeepSeek Harness development build\\n',
    });
    expect(result.status).toBe(1);
    expect(count).toBe(0);
    expect(receivedCalls).toEqual([['--version']]);
    expect(result.stderr.toString()).toContain('unrecognized version');
  });

  it('fails before profile mutation when the version command fails', () => {
    const { result, count, receivedCalls } = runLauncher([0], [], {
      installedVersion: '0.1.0-alpha.0',
      versionExitCode: 9,
    });
    expect(result.status).toBe(1);
    expect(count).toBe(0);
    expect(receivedCalls).toEqual([['--version']]);
    expect(result.stderr.toString()).toContain(
      'dsh --version did not complete successfully',
    );
  });

  it.skipIf(process.platform === 'win32')(
    'reports a dsh executable that cannot be executed',
    () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-console-unexecutable-'));
      temporaryDirectories.push(root);
      const fakeDsh = join(root, 'dsh');
      writeFileSync(fakeDsh, '#!/bin/sh\nexit 0\n');
      chmodSync(fakeDsh, 0o644);
      const result = spawnSync(
        process.execPath,
        [join(packageRoot, 'bin', 'dsh-console.js')],
        { env: { ...process.env, PATH: root } },
      );
      expect(result.status).toBe(1);
      expect(result.stderr.toString()).toContain(
        'unable to execute DeepSeek Harness',
      );
      expect(result.stderr.toString()).toContain(fakeDsh);
    },
  );

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

  it.skipIf(process.platform === 'win32')('propagates runtime signals', () => {
    const { result } = runLauncher([0], [], { runtimeSignal: 'SIGTERM' });
    expect(result.signal).toBe('SIGTERM');
  });

  it('removes a package-manager separator before forwarding CLI options', () => {
    const { result, receivedCalls } = runLauncher([0], ['--', '--debug']);
    expect(result.status).toBe(0);
    expect(receivedCalls.at(-1)).toEqual([
      '--profile',
      'dsh-console',
      '--debug',
    ]);
  });

  it('reconciles a stale source profile before launching it', () => {
    const { result, receivedCalls } = runLauncher([0, 0], [], {
      installedVersion: '0.1.0-alpha.0',
    });
    expect(result.status).toBe(0);
    expect(receivedCalls.slice(1)).toEqual([
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
    expect(receivedCalls.slice(1)).toEqual([
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
    expect(receivedCalls.slice(1)).toEqual([['--profile', 'dsh-console']]);
  });

  it('does not launch a stale profile when reconciliation fails', () => {
    const { result, receivedCalls } = runLauncher([7], [], {
      installedVersion: '0.1.0-alpha.0',
      launcherMode: 'published',
    });
    expect(result.status).toBe(7);
    expect(receivedCalls.slice(1)).toEqual([
      [
        'plugin',
        '--profile',
        'dsh-console',
        'add',
        `@cofy-x/dsh-console@${packageVersion}`,
      ],
    ]);
  });

  it('gives an explicit package spec precedence over an existing profile', () => {
    const packageSpec = `@cofy-x/dsh-console@${packageVersion}`;
    const { result, receivedCalls } = runLauncher([0, 0], [], {
      packageSpec,
    });
    expect(result.status).toBe(0);
    expect(receivedCalls.slice(1)).toEqual([
      ['plugin', '--profile', 'dsh-console', 'add', packageSpec],
      ['--profile', 'dsh-console'],
    ]);
  });
});
