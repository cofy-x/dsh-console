#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.join('src');
const targetDir = path.join('dist');

const extensionsToCopy = ['.md', '.json', '.sb', '.toml'];

function copyFilesRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const items = fs.readdirSync(source, { withFileTypes: true });

  for (const item of items) {
    const sourcePath = path.join(source, item.name);
    const targetPath = path.join(target, item.name);

    if (item.isDirectory()) {
      copyFilesRecursive(sourcePath, targetPath);
    } else if (extensionsToCopy.includes(path.extname(item.name))) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory ${sourceDir} not found.`);
  process.exit(1);
}

copyFilesRecursive(sourceDir, targetDir);

// Copy example extensions into the bundle.
const packageName = path.basename(process.cwd());
if (packageName === 'cli') {
  const examplesSource = path.join(
    sourceDir,
    'commands',
    'extensions',
    'examples',
  );
  const examplesTarget = path.join(
    targetDir,
    'commands',
    'extensions',
    'examples',
  );
  if (fs.existsSync(examplesSource)) {
    fs.cpSync(examplesSource, examplesTarget, { recursive: true });
  }

  // Copy pokemon header resources into the bundle.
  const pokemonSource = path.join(
    sourceDir,
    'ui',
    'components',
    'layout',
    'resources',
  );
  const pokemonTarget = path.join(
    targetDir,
    'ui',
    'components',
    'layout',
    'resources',
  );
  if (fs.existsSync(pokemonSource)) {
    fs.cpSync(pokemonSource, pokemonTarget, { recursive: true });
  }
}

// Copy built-in skills for the core package.
if (packageName === 'core') {
  const builtinSkillsSource = path.join(sourceDir, 'skills', 'builtin');
  const builtinSkillsTarget = path.join(targetDir, 'skills', 'builtin');
  if (fs.existsSync(builtinSkillsSource)) {
    fs.cpSync(builtinSkillsSource, builtinSkillsTarget, { recursive: true });
  }
}

console.log('Successfully copied files.');
