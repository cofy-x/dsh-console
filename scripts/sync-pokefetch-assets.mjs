/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [sourceArgument] = process.argv.slice(2).filter((argument) => argument !== '--');
const sourceRoot = sourceArgument ? resolve(sourceArgument) : undefined;

if (!sourceRoot) {
  throw new Error(
    'Usage: pnpm sync:pokefetch-assets -- /path/to/cofy-x/pokefetch',
  );
}

const sourceDirectory = join(sourceRoot, 'assets', 'pokemon');
const targetDirectory = join(
  repositoryRoot,
  'apps',
  'cli',
  'src',
  'ui',
  'components',
  'layout',
  'resources',
  'pokemon',
);
const targetParent = dirname(targetDirectory);
const [{ stdout: commitOutput }, { stdout: originOutput }, { stdout: statusOutput }] =
  await Promise.all([
    execFileAsync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD']),
    execFileAsync('git', ['-C', sourceRoot, 'remote', 'get-url', 'origin']),
    execFileAsync('git', [
      '-C',
      sourceRoot,
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      'assets/pokemon',
    ]),
  ]);
const commit = commitOutput.trim();
const origin = originOutput.trim();

if (!/(?:github\.com[:/])cofy-x\/pokefetch(?:\.git)?$/.test(origin)) {
  throw new Error(`Expected a cofy-x/pokefetch origin, received ${origin}`);
}
if (statusOutput.trim()) {
  throw new Error('Pokefetch assets must come from a clean source checkout.');
}

const files = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
  .map((entry) => entry.name)
  .sort();

if (files.length === 0) {
  throw new Error(`No Pokémon assets found in ${sourceDirectory}`);
}

const digest = createHash('sha256');
const stagingDirectory = await mkdtemp(join(targetParent, '.pokemon-sync-'));

try {
  for (const file of files) {
    const content = await readFile(join(sourceDirectory, file));
    digest.update(file);
    digest.update('\0');
    digest.update(content);
    await writeFile(join(stagingDirectory, file), content);
  }

  const manifest = {
    schemaVersion: 1,
    name: 'Pokefetch Pokémon',
    source: 'https://github.com/cofy-x/pokefetch',
    commit,
    sourceDirectory: 'assets/pokemon',
    assetCount: files.length,
    sha256: digest.digest('hex'),
  };

  await writeFile(
    join(stagingDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, undefined, 2)}\n`,
  );
  await rm(targetDirectory, { recursive: true, force: true });
  await rename(stagingDirectory, targetDirectory);
} catch (error) {
  await rm(stagingDirectory, { recursive: true, force: true });
  throw error;
}

console.log(
  `Synchronized ${String(files.length)} Pokefetch assets from ${commit}.`,
);
