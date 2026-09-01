#!/usr/bin/env node

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crossSpawn from 'cross-spawn';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
);
const packageName = '@cofy-x/dsh-console';
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
const profileRoot = join(dshHome, 'profiles', profile);
const profileManifest = join(profileRoot, 'package.json');
const installedManifest = join(
  profileRoot,
  'node_modules',
  '@cofy-x',
  'dsh-console',
  'package.json',
);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function profileNeedsInstall({ explicitPackageSpec, localCheckout }) {
  if (explicitPackageSpec) return true;

  const installed = readJson(installedManifest);
  if (installed?.name !== packageName || installed.version !== manifest.version)
    return true;

  if (localCheckout) {
    try {
      return (
        realpathSync(dirname(installedManifest)) !== realpathSync(packageRoot)
      );
    } catch {
      return true;
    }
  }

  const configured = readJson(profileManifest)?.dependencies?.[packageName];
  return configured !== manifest.version;
}

function run(command, args) {
  const result = crossSpawn.sync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    process.stderr.write(
      `dsh-console: unable to run ${command}: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.signal) process.kill(process.pid, result.signal);
  return result.status ?? 1;
}

const localCheckout = existsSync(join(packageRoot, 'src'));
const explicitPackageSpec = process.env.DSH_CONSOLE_PACKAGE_SPEC;
const packageSpec =
  explicitPackageSpec ||
  (localCheckout ? packageRoot : `${packageName}@${manifest.version}`);

if (profileNeedsInstall({ explicitPackageSpec, localCheckout })) {
  const status = run('dsh', [
    'plugin',
    '--profile',
    profile,
    'add',
    packageSpec,
  ]);
  if (status !== 0) process.exit(status);
}

let status;
do {
  status = run('dsh', ['--profile', profile, ...forwardedArgs]);
} while (status === RESTART_EXIT_CODE);
process.exit(status);
