/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRequire } from 'node:module';
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';

const cwd = process.cwd();
const manifest = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
const require = createRequire(join(cwd, 'package.json'));
const { build } = require('esbuild');
const distDir = join(cwd, 'dist');
const bundleDir = join(cwd, '.dist-runtime');

const publicDeclarations = new Set([
  'index.d.ts',
  'dsh/index.d.ts',
  'dsh/startup.d.ts',
  'ui/renderers.d.ts',
]);

function packageName(specifier) {
  if (specifier.startsWith('node:')) return undefined;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function pruneBuildOutput(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      pruneBuildOutput(path);
      if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
      continue;
    }

    const outputPath = relative(distDir, path).split(sep).join('/');
    const isRuntimeOutput = outputPath.endsWith('.js') || outputPath.endsWith('.js.map');
    const isPrivateDeclaration =
      outputPath.endsWith('.d.ts') && !publicDeclarations.has(outputPath);
    const isDeclarationMap = outputPath.endsWith('.d.ts.map');
    const isSourceFile = outputPath.endsWith('.ts') && !outputPath.endsWith('.d.ts');
    if (isRuntimeOutput || isPrivateDeclaration || isDeclarationMap || isSourceFile) {
      rmSync(path);
    }
  }
}

rmSync(bundleDir, { recursive: true, force: true });

try {
  const result = await build({
    entryPoints: {
      index: join(cwd, 'src', 'index.ts'),
      'dsh/index': join(cwd, 'src', 'dsh', 'index.ts'),
      'dsh/startup': join(cwd, 'src', 'dsh', 'startup.ts'),
      'ui/renderers': join(cwd, 'src', 'ui', 'renderers.ts'),
    },
    outdir: bundleDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    packages: 'external',
    alias: {
      '@cofy-x/dsh-console-core': join(cwd, '..', '..', 'packages', 'core', 'dist', 'index.js'),
    },
    legalComments: 'eof',
    metafile: true,
  });

  const declaredDependencies = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  const externalDependencies = new Set();
  for (const output of Object.values(result.metafile.outputs)) {
    for (const imported of output.imports) {
      if (!imported.external) continue;
      const name = packageName(imported.path);
      if (name) externalDependencies.add(name);
    }
  }

  const missingDependencies = [...externalDependencies]
    .filter((name) => !declaredDependencies.has(name))
    .sort();
  if (missingDependencies.length > 0) {
    throw new Error(
      `CLI bundle has undeclared external dependencies: ${missingDependencies.join(', ')}`,
    );
  }

  if (!existsSync(distDir)) throw new Error('TypeScript output directory is missing');
  pruneBuildOutput(distDir);
  cpSync(bundleDir, distDir, { recursive: true });
  console.log(`Bundled ${result.metafile.outputs ? Object.keys(result.metafile.outputs).length : 0} CLI runtime files.`);
} finally {
  rmSync(bundleDir, { recursive: true, force: true });
}
