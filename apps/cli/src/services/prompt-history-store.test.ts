/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptHistoryStore } from './prompt-history-store.js';

describe('PromptHistoryStore', () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-console-history-'));
    filePath = path.join(directory, 'nested', 'prompt_history.json');
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('persists prompts and reads them newest first', async () => {
    const store = new PromptHistoryStore(filePath);
    await store.append(' first ');
    await store.append('second');

    await expect(new PromptHistoryStore(filePath).read()).resolves.toEqual([
      'second',
      'first',
    ]);
  });

  it('serializes concurrent appends', async () => {
    const store = new PromptHistoryStore(filePath);
    await Promise.all([store.append('one'), store.append('two')]);
    await expect(store.read()).resolves.toEqual(['two', 'one']);
  });

  it('ignores empty prompts', async () => {
    const store = new PromptHistoryStore(filePath);
    await store.append('   ');
    await expect(store.read()).resolves.toEqual([]);
    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('backs up invalid data and starts a new history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '{invalid', 'utf8');

    const store = new PromptHistoryStore(filePath);
    await expect(store.read()).resolves.toEqual([]);
    await expect(
      fs.readFile(`${filePath}.invalid.${Date.now()}.bak`, 'utf8'),
    ).resolves.toBe('{invalid');
  });
});
