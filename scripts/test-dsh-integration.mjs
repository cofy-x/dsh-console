/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crossSpawn from 'cross-spawn';
import { validateDshSourceTarget } from './dsh-source-target.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliDir = join(root, 'apps', 'cli');
const dshBin = join(root, 'node_modules', '.bin', 'dsh');
const fakePlugin = pathToFileURL(
  join(root, 'scripts', 'fixtures', 'dsh-integration', 'fake-llm.mjs'),
).href;
const probePlugin = pathToFileURL(
  join(root, 'scripts', 'fixtures', 'dsh-integration', 'probe.mjs'),
).href;

async function run(command, args, options) {
  return await new Promise((resolvePromise, reject) => {
    const child = crossSpawn(command, args, {
      ...options,
      signal: AbortSignal.timeout(30_000),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
}

async function main() {
  const { target, publishManifest: cliManifest } =
    await validateDshSourceTarget();
  const dshManifest = JSON.parse(
    await readFile(
      join(root, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
      'utf8',
    ),
  );
  assert.equal(cliManifest.name, '@cofy-x/dsh-console');
  assert.deepEqual(cliManifest.dsh.compatibility, {
    minimum: '0.1.1-rc.2',
    maximumTested: target.version,
  });
  assert.ok(
    [
      cliManifest.dsh.compatibility.minimum,
      cliManifest.dsh.compatibility.maximumTested,
    ].includes(dshManifest.version),
    `installed DSH ${dshManifest.version} must be an audited compatibility endpoint`,
  );
  assert.match(cliManifest.version, /^\d+\.\d+\.\d+-alpha\.\d+$/);
  assert.equal(
    Object.keys(cliManifest.dependencies).some(
      (name) =>
        name === '@deepseek-ai/cordis' || name.startsWith('@deepseek-ai/dsh-'),
    ),
    false,
    'DSH and Cordis runtime packages must remain host-provided peers',
  );

  const temporaryRoot = await mkdtemp(
    join(tmpdir(), 'dsh-console-integration-'),
  );
  try {
    const home = join(temporaryRoot, '.dsh');
    const profileDir = join(home, 'profiles', 'dsh-console-integration');
    const packageDir = join(profileDir, 'node_modules', '@cofy-x');
    const resultFile = join(temporaryRoot, 'result.json');
    await mkdir(packageDir, { recursive: true });
    await symlink(
      cliDir,
      join(packageDir, 'dsh-console'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await writeFile(
      join(profileDir, 'package.json'),
      JSON.stringify(
        {
          name: 'dsh-profile-dsh-console-integration',
          private: true,
          dependencies: { '@cofy-x/dsh-console': cliManifest.version },
          dsh: {
            profile: {
              bundles: ['@deepseek-ai/dsh-base', '@cofy-x/dsh-console'],
            },
          },
        },
        undefined,
        2,
      ),
    );
    await writeFile(
      join(profileDir, 'cordis.patch.yml'),
      [
        '- id: dsh-console-runner',
        '  disabled: true',
        '- id: session-title-llm',
        '  disabled: true',
        '- insert:',
        '    - id: dsh-console-integration-fake-llm',
        `      name: '${fakePlugin}'`,
        '    - id: dsh-console-integration-probe',
        `      name: '${probePlugin}'`,
        '      inject: [dshConsoleIntegration]',
        '',
      ].join('\n'),
    );

    const result = await run(dshBin, ['--profile', 'dsh-console-integration'], {
      cwd: temporaryRoot,
      env: {
        ...process.env,
        DSH_HOME: home,
        DSH_AGENTS_HOME: join(temporaryRoot, '.agents'),
        DSH_CONSOLE_INTEGRATION_RESULT: resultFile,
        DSH_TELEMETRY_DISABLED: '1',
        DEEPSEEK_API_KEY: 'keyless-integration-no-network-call',
      },
    });
    assert.equal(
      result.code,
      0,
      `dsh integration exited ${String(result.code)} (${String(result.signal)})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    const observed = JSON.parse(await readFile(resultFile, 'utf8'));
    assert.equal(observed.assistantText, 'DSH Console integration ready.');
    assert.equal(observed.flushed, true);
    assert.equal(observed.sessionId, 'dsh-console-integration');
    const userIndex = observed.eventTypes.indexOf('user/message');
    const assistantIndex = observed.eventTypes.indexOf('assistant/message');
    const turnEndIndex = observed.eventTypes.indexOf('turn/end');
    assert.ok(userIndex >= 0, 'the DSH Session must record a user message');
    assert.ok(
      assistantIndex > userIndex,
      'the DSH Session must record the assistant message after user input',
    );
    assert.ok(
      turnEndIndex > assistantIndex,
      'the DSH Session must end the turn after the assistant message',
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await main();
