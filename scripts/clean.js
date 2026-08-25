/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// remove npm install/build artifacts
rmSync(join(root, 'node_modules'), { recursive: true, force: true });
rmSync(join(root, 'bundle'), { recursive: true, force: true });
rmSync(join(root, 'apps/cli/src/generated/'), {
  recursive: true,
  force: true,
});
const RMRF_OPTIONS = { recursive: true, force: true };
rmSync(join(root, 'bundle'), RMRF_OPTIONS);
// Dynamically clean dist directories in all workspaces
const rootPackageJson = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf-8'),
);
for (const workspace of rootPackageJson.workspaces) {
  // Note: this is a simple glob implementation that only supports "packages/*".
  const workspaceDir = join(root, dirname(workspace));
  const packageDirs = readdirSync(workspaceDir);

  for (const pkg of packageDirs) {
    const pkgDir = join(workspaceDir, pkg);
    try {
      if (statSync(pkgDir).isDirectory()) {
        rmSync(join(pkgDir, 'dist'), RMRF_OPTIONS);
        rmSync(join(pkgDir, 'node_modules'), RMRF_OPTIONS);
        rmSync(join(pkgDir, 'tsconfig.tsbuildinfo'), RMRF_OPTIONS);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }
}

// Clean up vscode-ide-companion package
rmSync(join(root, 'packages/vscode-ide-companion/node_modules'), {
  recursive: true,
  force: true,
});

const vscodeCompanionDir = join(root, 'packages/vscode-ide-companion');
try {
  const files = readdirSync(vscodeCompanionDir);
  for (const file of files) {
    if (file.endsWith('.vsix')) {
      rmSync(join(vscodeCompanionDir, file), RMRF_OPTIONS);
    }
  }
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw e;
  }
}
