/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lint } from 'markdownlint/promise';

export async function collectMarkdownFiles(docsRoot) {
  const files = [];
  for (const name of ['README.md', 'AGENTS.md']) {
    const file = path.join(docsRoot, name);
    if (!(await lstat(file)).isFile()) {
      throw new Error(`Expected a regular Markdown file: ${file}`);
    }
    files.push(file);
  }

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(file);
    }
  }

  await visit(path.join(docsRoot, 'src/content/docs'));
  return files.sort();
}

export async function checkMarkdown(docsRoot) {
  const config = JSON.parse(
    await readFile(path.join(docsRoot, '.markdownlint.json'), 'utf8'),
  );
  const files = await collectMarkdownFiles(docsRoot);
  const results = await lint({ files, config });
  const diagnostics = files.flatMap((file) =>
    results[file].map((diagnostic) => ({ file, ...diagnostic })),
  );
  return { files, diagnostics };
}

export function formatDiagnostic(docsRoot, diagnostic) {
  const file = path
    .relative(docsRoot, diagnostic.file)
    .split(path.sep)
    .join('/');
  const detail = diagnostic.errorDetail ? ` [${diagnostic.errorDetail}]` : '';
  return `${file}:${diagnostic.lineNumber}: ${diagnostic.ruleNames[0]} ${diagnostic.ruleDescription}${detail}`;
}

export async function runMarkdownLint(docsRoot, output = console) {
  const { files, diagnostics } = await checkMarkdown(docsRoot);
  for (const diagnostic of diagnostics) {
    output.error(formatDiagnostic(docsRoot, diagnostic));
  }
  if (diagnostics.length > 0) return 1;
  output.log(`markdown_lint_ok=true files=${files.length}`);
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await runMarkdownLint(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
