#!/usr/bin/env node

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const profile = 'dsh-console';
const RESTART_EXIT_CODE = 199;
const forwardedArgs = process.argv.slice(2);

// Package managers preserve the conventional argument separator when running
// scripts. It separates package-manager options and is not part of the CLI's
// argument surface.
if (forwardedArgs[0] === '--') forwardedArgs.shift();

if (forwardedArgs[0] === '--version' || forwardedArgs[0] === '-V') {
  process.stdout.write(`${manifest.version}\n`);
  process.exit(0);
}

const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
const installedManifest = join(
  dshHome,
  'profiles',
  profile,
  'node_modules',
  '@cofy-x',
  'dsh-console',
  'package.json',
);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) {
    process.stderr.write(`dsh-console: unable to run ${command}: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.signal) process.kill(process.pid, result.signal);
  return result.status ?? 1;
}

if (!existsSync(installedManifest)) {
  const localCheckout = existsSync(join(packageRoot, 'src'));
  const packageSpec =
    process.env.DSH_CONSOLE_PACKAGE_SPEC ||
    (localCheckout ? packageRoot : `@cofy-x/dsh-console@${manifest.version}`);
  const status = run('dsh', ['plugin', '--profile', profile, 'add', packageSpec]);
  if (status !== 0) process.exit(status);
}

let status;
do {
  status = run('dsh', ['--profile', profile, ...forwardedArgs]);
} while (status === RESTART_EXIT_CODE);
process.exit(status);
