import assert from 'node:assert/strict';
import { lstat, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const sourceRoot = resolve(process.argv[2] ?? '');
assert.notEqual(
  sourceRoot,
  resolve(''),
  'usage: node scripts/use-dsh-source.mjs <deepseek-harness-root>',
);

const packages = new Map();
async function discover(directory, depth = 0) {
  if (depth > 6) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      ['.git', 'node_modules', 'dist', 'coverage'].includes(entry.name)
    )
      continue;
    const child = join(directory, entry.name);
    try {
      const manifest = JSON.parse(
        await readFile(join(child, 'package.json'), 'utf8'),
      );
      if (
        typeof manifest.name === 'string' &&
        manifest.name.startsWith('@deepseek-ai/')
      ) {
        packages.set(manifest.name, child);
      }
    } catch {
      // Most workspace directories are not package roots.
    }
    await discover(child, depth + 1);
  }
}
await discover(sourceRoot);

const sourceDsh = packages.get('@deepseek-ai/dsh');
assert.ok(
  sourceDsh,
  'DeepSeek Harness source checkout does not contain @deepseek-ai/dsh',
);
const sourceVersion = JSON.parse(
  await readFile(join(sourceDsh, 'package.json'), 'utf8'),
).version;
const productManifest = JSON.parse(await readFile('package.json', 'utf8'));
const publishManifestPath = productManifest.private
  ? join('apps', 'cli', 'package.json')
  : 'package.json';
const publishManifest = JSON.parse(await readFile(publishManifestPath, 'utf8'));
assert.equal(sourceVersion, publishManifest.dsh?.compatibility?.maximumTested);

const targets = productManifest.private
  ? ['node_modules', join('apps', 'cli', 'node_modules')]
  : ['node_modules'];
const linked = new Set();
for (const target of targets) {
  const scope = join(target, '@deepseek-ai');
  let entries;
  try {
    entries = await readdir(scope);
  } catch {
    continue;
  }
  for (const entry of entries) {
    const name = `@deepseek-ai/${entry}`;
    const source = packages.get(name);
    if (source === undefined) continue;
    const destination = join(scope, entry);
    try {
      await lstat(destination);
    } catch {
      continue;
    }
    await rm(destination, { recursive: true, force: true });
    await symlink(
      source,
      destination,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    linked.add(name);
  }
}
for (const name of Object.keys(publishManifest.peerDependencies ?? {})) {
  if (
    (name === '@deepseek-ai/cordis' || name.startsWith('@deepseek-ai/dsh-')) &&
    packages.has(name)
  ) {
    assert.ok(
      linked.has(name),
      `${name} was not replaced with the audited DSH source release`,
    );
  }
}
if (productManifest.private && process.platform !== 'win32') {
  const dshBin = join('node_modules', '.bin', 'dsh');
  await rm(dshBin, { force: true });
  await symlink(join(sourceDsh, 'lib', 'bin.js'), dshBin);
}
console.log(
  `using ${linked.size} DeepSeek Harness source packages at ${sourceVersion}`,
);
