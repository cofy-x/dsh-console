/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Clean dist directories before building (optional - can be customized per project)
const distDirsToClean = [
  join(root, 'packages', 'core', 'dist'),
  join(root, 'packages', 'types', 'dist'),
  join(root, 'packages', 'schema', 'dist'),
];

for (const distDir of distDirsToClean) {
  try {
    if (existsSync(distDir)) {
      rmSync(distDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore errors during cleanup
  }
}

// pnpm install if node_modules was removed
if (!existsSync(join(root, 'node_modules'))) {
  console.log('Installing dependencies...');
  execSync('pnpm install', { stdio: 'inherit', cwd: root });
}

// build all workspaces/packages
// Use 'generate' if needed for code generation before build
execSync('pnpm run generate', { stdio: 'inherit', cwd: root });

console.log('Phase 1: Building Infrastructure & Packages...');
// Key change: Force build of all packages under the packages directory first.
// This ensures that when apps start building, all dependency package dist directories exist and are complete.
// Fix: Move --filter BEFORE 'run build' to prevent recursion loop (pnpm interprets trailing args as script args)
execSync('pnpm --filter "./packages/**" run build', {
  stdio: 'inherit',
  cwd: root,
});

console.log('Refreshing dependencies to ensure workspace links are valid...');
// Critical Step: Re-run install to refresh symlinks and package metadata now that dist folders exist.
// This prevents 'module not found' errors in apps that depend on the newly built packages.
execSync('pnpm install', { stdio: 'inherit', cwd: root });

console.log('Phase 2: Building Applications...');
// Key change: Build apps only after dependencies are ready.
// Fix: Move --filter BEFORE 'run build'
execSync('pnpm --filter "./apps/**" run build', {
  stdio: 'inherit',
  cwd: root,
});
