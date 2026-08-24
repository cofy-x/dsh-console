/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

function runLauncher(exitCodes: number[], args: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-console-launcher-'));
  temporaryDirectories.push(root);
  const dshHome = join(root, 'home');
  const fakeBin = join(root, 'bin');
  const counter = join(root, 'count');
  const receivedArgs = join(root, 'args.json');
  const installedManifest = join(
    dshHome,
    'profiles',
    'dsh-console',
    'node_modules',
    '@cofy-x',
    'dsh-console',
    'package.json',
  );
  mkdirSync(dirname(installedManifest), { recursive: true });
  writeFileSync(installedManifest, '{}');
  mkdirSync(fakeBin, { recursive: true });
  const fakeDsh = join(fakeBin, 'dsh');
  writeFileSync(
    fakeDsh,
    `#!/usr/bin/env node
const fs = require('node:fs');
const countFile = process.env.DSH_CONSOLE_TEST_COUNT;
const count = fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) + 1 : 1;
fs.writeFileSync(countFile, String(count));
fs.writeFileSync(process.env.DSH_CONSOLE_TEST_ARGS, JSON.stringify(process.argv.slice(2)));
const codes = JSON.parse(process.env.DSH_CONSOLE_TEST_CODES);
process.exit(codes[Math.min(count - 1, codes.length - 1)]);
`,
  );
  chmodSync(fakeDsh, 0o755);

  const result = spawnSync(process.execPath, [resolve('bin/dsh-console.js'), ...args], {
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      DSH_CONSOLE_TEST_COUNT: counter,
      DSH_CONSOLE_TEST_ARGS: receivedArgs,
      DSH_CONSOLE_TEST_CODES: JSON.stringify(exitCodes),
      PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
    },
  });

  return {
    result,
    count: Number(readFileSync(counter, 'utf8')),
    receivedArgs: JSON.parse(readFileSync(receivedArgs, 'utf8')) as string[],
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
    const { result, receivedArgs } = runLauncher([0], ['--', '--debug']);

    expect(result.status).toBe(0);
    expect(receivedArgs).toEqual(['--profile', 'dsh-console', '--debug']);
  });
});
