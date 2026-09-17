#!/usr/bin/env node

/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crossSpawn from 'cross-spawn';
import semver from 'semver';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
);
const packageName = '@cofy-x/dsh-console';
const profile = 'dsh-console';
const RESTART_EXIT_CODE = 199;
const forwardedArgs = process.argv.slice(2);
const compatibility = manifest.dsh?.compatibility;

// Package managers preserve the conventional argument separator when running
// scripts. It separates package-manager options and is not part of the CLI's
// argument surface.
if (forwardedArgs[0] === '--') forwardedArgs.shift();

if (forwardedArgs[0] === '--version' || forwardedArgs[0] === '-V') {
  process.stdout.write(`${manifest.version}\n`);
  process.exit(0);
}

function fail(lines) {
  process.stderr.write(`${lines.join('\n')}\n`);
  process.exit(1);
}

const minimumDshVersion = semver.valid(compatibility?.minimum);
const maximumTestedDshVersion = semver.valid(compatibility?.maximumTested);
if (
  !minimumDshVersion ||
  !maximumTestedDshVersion ||
  semver.gt(minimumDshVersion, maximumTestedDshVersion)
) {
  fail(['dsh-console: invalid DSH compatibility metadata in package.json.']);
}

const installDshCommand = `npm install --global @deepseek-ai/dsh@${minimumDshVersion}`;

function environmentValue(name) {
  const entry = Object.entries(process.env).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return entry?.[1];
}

function resolveDshExecutable() {
  const searchPath = environmentValue('PATH');
  if (!searchPath) return undefined;

  const names = ['dsh'];
  if (process.platform === 'win32') {
    const extensions = (environmentValue('PATHEXT') || '.COM;.EXE;.BAT;.CMD')
      .split(delimiter)
      .filter(Boolean);
    names.push(...extensions.map((extension) => `dsh${extension}`));
  }

  let inaccessible;
  for (const directory of searchPath.split(delimiter)) {
    const root = resolve(directory || process.cwd());
    for (const name of names) {
      const candidate = join(root, name);
      try {
        if (!statSync(candidate).isFile()) continue;
        if (process.platform !== 'win32') accessSync(candidate, constants.X_OK);
        return candidate;
      } catch (error) {
        if (existsSync(candidate) && error?.code === 'EACCES') {
          inaccessible ||= candidate;
        }
      }
    }
  }
  return inaccessible;
}

function parseDshVersion(output) {
  const match = output.match(
    /(?:^|[^0-9A-Za-z-])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)(?=$|[^0-9A-Za-z-])/,
  );
  return match ? semver.valid(match[1]) : null;
}

function remediation(executable = 'not found on PATH') {
  return [
    `DSH executable: ${executable}`,
    `Minimum supported version: ${minimumDshVersion}`,
    `Install the compatible release: ${installDshCommand}`,
    'Then verify: dsh --version',
  ];
}

const dshExecutable = resolveDshExecutable();
if (!dshExecutable) {
  fail([
    'dsh-console: DeepSeek Harness is required but dsh was not found.',
    ...remediation(),
  ]);
}

const versionResult = crossSpawn.sync(dshExecutable, ['--version'], {
  encoding: 'utf8',
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (versionResult.error) {
  fail([
    'dsh-console: unable to execute DeepSeek Harness.',
    ...remediation(dshExecutable),
    `Reason: ${versionResult.error.message}`,
  ]);
}
if (versionResult.signal || versionResult.status !== 0) {
  fail([
    'dsh-console: dsh --version did not complete successfully.',
    ...remediation(dshExecutable),
    `Exit: ${versionResult.signal || String(versionResult.status)}`,
  ]);
}

const versionOutput = `${versionResult.stdout || ''}\n${versionResult.stderr || ''}`;
const detectedDshVersion = parseDshVersion(versionOutput);
if (!detectedDshVersion) {
  const summary = versionOutput.trim().replace(/\s+/g, ' ').slice(0, 160);
  fail([
    'dsh-console: dsh --version returned an unrecognized version.',
    ...remediation(dshExecutable),
    `Output: ${summary ? JSON.stringify(summary) : '(empty)'}`,
  ]);
}
if (semver.lt(detectedDshVersion, minimumDshVersion)) {
  fail([
    'dsh-console: the selected DeepSeek Harness release is too old.',
    `DSH executable: ${dshExecutable}`,
    `Detected version: ${detectedDshVersion}`,
    `Minimum supported version: ${minimumDshVersion}`,
    `Install the compatible release: ${installDshCommand}`,
    'Then verify: dsh --version',
  ]);
}
if (semver.gt(detectedDshVersion, maximumTestedDshVersion)) {
  process.stderr.write(
    `dsh-console: warning: DSH ${detectedDshVersion} at ${dshExecutable} is newer than the maximum tested version ${maximumTestedDshVersion}; continuing without a formal compatibility guarantee.\n`,
  );
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
  const status = run(dshExecutable, [
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
  status = run(dshExecutable, ['--profile', profile, ...forwardedArgs]);
} while (status === RESTART_EXIT_CODE);
process.exit(status);
