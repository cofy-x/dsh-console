/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, cpSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';

const cwd = process.cwd();
const packageName = basename(cwd);

// The public CLI tarball must never retain outputs for deleted or renamed
// sources. Keep other workspace packages incremental for now.
if (isCliPackage()) {
  rmSync(join(cwd, 'dist'), { recursive: true, force: true });
  rmSync(join(cwd, 'tsconfig.tsbuildinfo'), { force: true });
}

const isPackage = cwd.includes('/packages/') || cwd.includes('\\packages\\');
const isApp = cwd.includes('/apps/') || cwd.includes('\\apps\\');

if (!isPackage && !isApp) {
  console.error('must be invoked from a package or app directory');
  process.exit(1);
}

/**
 * Determine if we should force rebuild based on:
 * 1. FORCE_BUILD environment variable
 * 2. Missing dist directory
 * 3. Missing tsconfig.tsbuildinfo (indicates need for full build)
 */
function shouldForceRebuild() {
  // Explicit force via environment variable
  if (process.env.FORCE_BUILD === 'true' || process.env.FORCE_BUILD === '1') {
    return true;
  }

  const distDir = join(cwd, 'dist');
  const tsbuildInfo = join(cwd, 'tsconfig.tsbuildinfo');

  // Force rebuild if dist doesn't exist
  if (!existsSync(distDir)) {
    return true;
  }

  // Force rebuild if tsbuildinfo doesn't exist (no cache available)
  // This happens after 'pnpm run clean' or fresh clone
  if (!existsSync(tsbuildInfo)) {
    return true;
  }

  return false;
}

// Determine build flags
const forceRebuild = shouldForceRebuild();
const buildFlags = forceRebuild ? '--build --force' : '--build';

if (forceRebuild) {
  console.log('Performing clean rebuild...');
}

function isCliPackage() {
  return packageName === 'cli' &&
    (cwd.includes('/apps/') || cwd.includes('\\apps\\'));
}

// build typescript files
execSync(`tsc ${buildFlags}`, { stdio: 'inherit' });

// copy .{md,json} files
execSync('node ../../scripts/copy_files.js', { stdio: 'inherit' });

if (isCliPackage()) {
  execSync('node ../../scripts/bundle_cli.js', { stdio: 'inherit' });
}

// Copy documentation for the core package
if (packageName === 'core') {
  const docsSource = join(process.cwd(), '..', '..', 'docs');
  const docsTarget = join(process.cwd(), 'dist', 'docs');
  if (existsSync(docsSource)) {
    cpSync(docsSource, docsTarget, { recursive: true, dereference: true });
    console.log('Copied documentation to dist/docs');
  }
}

// touch dist/.last_build
writeFileSync(join(process.cwd(), 'dist', '.last_build'), '');
process.exit(0);
