/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { access, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import {
  check,
  format as formatText,
  getFileInfo,
  resolveConfig,
} from 'prettier';

function git(args, allowFailure = false) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', allowFailure ? 'ignore' : 'inherit'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

function names(output) {
  return output
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

function changedFiles() {
  if (process.env.FORMAT_SINCE_TAG === '1') {
    const tag = git(['describe', '--tags', '--abbrev=0', 'HEAD^'], true);
    return tag
      ? names(
          git(['diff', '--name-only', '--diff-filter=ACMR', `${tag}...HEAD`]),
        )
      : names(git(['ls-files']));
  }

  const base = process.env.FORMAT_BASE_REF;
  if (base && !/^0+$/.test(base)) {
    return names(
      git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]),
    );
  }

  const working = new Set([
    ...names(git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'])),
    ...names(git(['ls-files', '--others', '--exclude-standard'])),
  ]);
  if (working.size > 0) return [...working];

  const parent = git(['rev-parse', '--verify', 'HEAD^'], true);
  return parent
    ? names(git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD^', 'HEAD']))
    : names(git(['ls-files']));
}

const candidates = [...new Set(changedFiles())].sort();
const write = process.argv.includes('--write');
const failures = [];
let checked = 0;
let updated = 0;

for (const file of candidates) {
  try {
    await access(file);
  } catch {
    continue;
  }
  const info = await getFileInfo(file, { ignorePath: '.prettierignore' });
  if (info.ignored || info.inferredParser === null) continue;
  const config = await resolveConfig(file);
  const source = await readFile(file, 'utf8');
  const options = {
    ...config,
    filepath: file,
  };
  checked += 1;
  if (write) {
    const formatted = await formatText(source, options);
    if (formatted !== source) {
      await writeFile(file, formatted);
      updated += 1;
    }
  } else if (!(await check(source, options))) {
    failures.push(file);
  }
}

if (write) {
  process.stdout.write(
    `Formatted ${checked} changed file(s); updated ${updated}.\n`,
  );
} else if (failures.length > 0) {
  process.stderr.write(
    `Formatting issues found in ${failures.length} changed file(s):\n${failures.map((file) => `- ${file}`).join('\n')}\nRun pnpm run format.\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`Checked formatting in ${checked} changed file(s).\n`);
}
