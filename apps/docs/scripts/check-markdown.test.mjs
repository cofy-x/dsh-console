/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  checkMarkdown,
  collectMarkdownFiles,
  runMarkdownLint,
} from './check-markdown.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-docs-markdown-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'src/content/docs/zh-cn'), { recursive: true });
  await writeFile(path.join(root, 'README.md'), '# Documentation\n');
  await writeFile(path.join(root, 'AGENTS.md'), '# Contributor Guide\n');
  await writeFile(
    path.join(root, '.markdownlint.json'),
    JSON.stringify({
      MD013: false,
      MD024: { siblings_only: true },
      MD033: false,
    }),
  );
  return root;
}

test('enumerates the original lint boundary deterministically without following links', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'src/content/docs/z.md'), '# Last\n');
  await writeFile(path.join(root, 'src/content/docs/zh-cn/a.md'), '# First\n');
  await writeFile(
    path.join(root, 'src/content/docs/ignored.txt'),
    '#Heading\n',
  );
  await mkdir(path.join(root, 'src/content/docs/.hidden'));
  await writeFile(
    path.join(root, 'src/content/docs/.hidden/bad.md'),
    '#Heading\n',
  );
  await symlink(
    path.join(root, 'README.md'),
    path.join(root, 'src/content/docs/link.md'),
  );
  assert.deepEqual(
    (await collectMarkdownFiles(root)).map((file) =>
      path.relative(root, file).split(path.sep).join('/'),
    ),
    [
      'AGENTS.md',
      'README.md',
      'src/content/docs/z.md',
      'src/content/docs/zh-cn/a.md',
    ],
  );
});

test('preserves long prose, inline HTML and sibling-only duplicate-heading exceptions', async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, 'src/content/docs/guide.md'),
    `# Guide\n\n## Alpha\n\n### Shared\n\n## Beta\n\n### Shared\n\n<kbd>Enter</kbd>\n\n${'Long prose '.repeat(30).trim()}\n`,
  );
  assert.deepEqual((await checkMarkdown(root)).diagnostics, []);
});

test('retains default rules, actionable diagnostics and a failing exit status', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'src/content/docs/bad.md'), '#Heading\n');
  const messages = [];
  const exitCode = await runMarkdownLint(root, {
    error: (message) => messages.push(message),
    log: () => assert.fail('A failing lint must not report success'),
  });
  assert.equal(exitCode, 1);
  assert.ok(
    messages.some((message) =>
      message.startsWith('src/content/docs/bad.md:1: MD018 '),
    ),
  );
});

test('still rejects duplicate headings within the same parent', async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, 'src/content/docs/bad.md'),
    '# Guide\n\n## Same\n\nText.\n\n## Same\n',
  );
  assert.ok(
    (await checkMarkdown(root)).diagnostics.some(
      (diagnostic) => diagnostic.ruleNames[0] === 'MD024',
    ),
  );
});

test('reports success only after every in-scope Markdown file passes', async (t) => {
  const root = await fixture(t);
  const messages = [];
  assert.equal(
    await runMarkdownLint(root, {
      error: () => assert.fail('Expected no lint errors'),
      log: (message) => messages.push(message),
    }),
    0,
  );
  assert.deepEqual(messages, ['markdown_lint_ok=true files=2']);
});

test('fails closed when a required file or the configuration is invalid', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, '.markdownlint.json'), '{');
  await assert.rejects(checkMarkdown(root), SyntaxError);
  await writeFile(path.join(root, '.markdownlint.json'), '{}');
  await rm(path.join(root, 'AGENTS.md'));
  await assert.rejects(checkMarkdown(root), { code: 'ENOENT' });
});
