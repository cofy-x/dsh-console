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
import { spawn as spawnPty } from '@lydell/node-pty';
import { validateDshSourceTarget } from './dsh-source-target.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliDir = join(root, 'apps', 'cli');
const dshPackageDir = join(root, 'node_modules', '@deepseek-ai', 'dsh');
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

async function exerciseConsoleProductPath(command, args, options) {
  const terminal = spawnPty(command, args, {
    cwd: options.cwd,
    env: options.env,
    name: 'xterm-256color',
    cols: 100,
    rows: 32,
  });
  let output = '';
  let exit;
  const exited = new Promise((resolvePromise) => {
    terminal.onExit((result) => {
      exit = result;
      resolvePromise(result);
    });
  });
  terminal.onData((data) => {
    output += data;
  });

  const waitFor = async (text, start = 0) => {
    const deadline = Date.now() + 30_000;
    while (!output.slice(start).includes(text)) {
      if (exit !== undefined) {
        throw new Error(
          `dsh-console exited before rendering ${JSON.stringify(text)}\n${output}`,
        );
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `dsh-console timed out waiting for ${JSON.stringify(text)}\n${output}`,
        );
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
  };
  const waitForRedraw = async (start) => {
    const deadline = Date.now() + 30_000;
    while (output.length === start) {
      if (exit !== undefined) {
        throw new Error(`dsh-console exited before redrawing\n${output}`);
      }
      if (Date.now() >= deadline) {
        throw new Error(`dsh-console timed out waiting to redraw\n${output}`);
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
  };
  const submit = async (line, expected, confirmCompletion = false) => {
    const start = output.length;
    terminal.write(`${line}\r`);
    if (confirmCompletion) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      terminal.write('\r');
    }
    await waitFor(expected, start);
    return output.slice(start);
  };

  try {
    await waitFor('Ready (');
    await waitFor('Ready (', output.indexOf('Ready (') + 1);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    const minimal = await submit('/preset minimal', '(minimal).', true);
    assert.doesNotMatch(minimal, /failed to mount|operation was aborted/i);
    const standard = await submit('/preset standard', '(standard).', true);
    assert.doesNotMatch(standard, /failed to mount|operation was aborted/i);
    const presetStart = output.length;
    terminal.write('/preset\r');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    terminal.write('\r');
    await waitFor('Select DSH Agent Preset', presetStart);
    assert.doesNotMatch(
      output.slice(presetStart),
      /failed to mount|operation was aborted/i,
    );
    const presetDismissStart = output.length;
    terminal.write('\u001b');
    await waitForRedraw(presetDismissStart);
    const skillsStart = output.length;
    terminal.write('/skills\r');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    terminal.write('\r');
    await waitFor('DSH Skills (', skillsStart);
    await waitFor('/integration-skill', skillsStart);
    assert.doesNotMatch(
      output.slice(skillsStart),
      /failed to mount|operation was aborted/i,
    );
    const skillsDismissStart = output.length;
    terminal.write('\u001b');
    await waitForRedraw(skillsDismissStart);
    const invocation = await submit(
      '/integration-skill verify the product path',
      'DSH Console integration ready.',
      true,
    );
    assert.doesNotMatch(invocation, /Unknown command|operation was aborted/i);
    await submit('/quit', 'Agent powering down. Goodbye!', true);
    const result = await exited;
    assert.equal(
      result.exitCode,
      0,
      `dsh-console product path exited ${String(result.exitCode)}\n${output}`,
    );
  } finally {
    if (exit === undefined) {
      terminal.kill();
      await exited;
    }
  }
}

async function main() {
  const { target, publishManifest: cliManifest } =
    await validateDshSourceTarget();
  const dshManifest = JSON.parse(
    await readFile(join(dshPackageDir, 'package.json'), 'utf8'),
  );
  const dshBin =
    typeof dshManifest.bin === 'string'
      ? dshManifest.bin
      : dshManifest.bin?.dsh;
  assert.equal(typeof dshBin, 'string', 'DSH must declare its dsh binary');
  const dshEntry = resolve(dshPackageDir, dshBin);
  assert.equal(cliManifest.name, '@cofy-x/dsh-console');
  assert.deepEqual(cliManifest.dsh.compatibility, {
    minimum: '0.1.5-rc.1',
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

    const result = await run(
      process.execPath,
      [dshEntry, '--profile', 'dsh-console-integration'],
      {
        cwd: temporaryRoot,
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_AGENTS_HOME: join(temporaryRoot, '.agents'),
          DSH_CONSOLE_INTEGRATION_RESULT: resultFile,
          DSH_TELEMETRY_DISABLED: '1',
          DEEPSEEK_API_KEY: 'keyless-integration-no-network-call',
        },
      },
    );
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

    const productProfile = 'dsh-console-product-path';
    const productProfileDir = join(home, 'profiles', productProfile);
    const productPackageDir = join(
      productProfileDir,
      'node_modules',
      '@cofy-x',
    );
    const agentsHome = join(temporaryRoot, '.agents');
    await mkdir(productPackageDir, { recursive: true });
    await symlink(
      cliDir,
      join(productPackageDir, 'dsh-console'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await writeFile(
      join(productProfileDir, 'package.json'),
      JSON.stringify(
        {
          name: 'dsh-profile-dsh-console-product-path',
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
      join(productProfileDir, 'cordis.patch.yml'),
      [
        '- id: session-title-llm',
        '  disabled: true',
        '- id: agent-default-model',
        '  config:',
        '    provider: dsh-console-fake',
        '    model: alpha',
        '- insert:',
        '    - id: dsh-console-product-path-fake-llm',
        `      name: '${fakePlugin}'`,
        '',
      ].join('\n'),
    );
    const skillDir = join(agentsHome, 'skills', 'integration-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: integration-skill',
        'description: Verify the real DSH Console Skill product path.',
        '---',
        '',
        '# Integration Skill',
        '',
        'Reply after loading this Skill.',
        '',
      ].join('\n'),
    );
    await exerciseConsoleProductPath(
      process.execPath,
      [dshEntry, '--profile', productProfile],
      {
        cwd: temporaryRoot,
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_AGENTS_HOME: agentsHome,
          DSH_TELEMETRY_DISABLED: '1',
          DEEPSEEK_API_KEY: 'keyless-integration-no-network-call',
        },
      },
    );
  } finally {
    await rm(temporaryRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}

await main();
