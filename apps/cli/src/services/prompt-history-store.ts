/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_HISTORY_ENTRIES = 1000;

interface PromptHistoryEntry {
  prompt: string;
  timestamp: string;
}

function isPromptHistoryEntry(value: unknown): value is PromptHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['prompt'] === 'string' &&
    typeof entry['timestamp'] === 'string'
  );
}

/**
 * Persists terminal input history independently from canonical DSH Sessions.
 */
export class PromptHistoryStore {
  private entries: PromptHistoryEntry[] | undefined;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async read(): Promise<string[]> {
    await this.writeQueue.catch(() => {});
    const entries = await this.load();
    return entries
      .slice()
      .reverse()
      .map((entry) => entry.prompt);
  }

  append(prompt: string): Promise<void> {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) return Promise.resolve();

    const operation = this.writeQueue
      .catch(() => {})
      .then(async () => {
        const entries = await this.load();
        entries.push({
          prompt: normalizedPrompt,
          timestamp: new Date().toISOString(),
        });
        if (entries.length > MAX_HISTORY_ENTRIES) {
          entries.splice(0, entries.length - MAX_HISTORY_ENTRIES);
        }
        await this.writeAtomically(entries);
      });
    this.writeQueue = operation;
    return operation;
  }

  private async load(): Promise<PromptHistoryEntry[]> {
    if (this.entries) return this.entries;

    try {
      const parsed: unknown = JSON.parse(
        await fs.readFile(this.filePath, 'utf8'),
      );
      if (!Array.isArray(parsed) || !parsed.every(isPromptHistoryEntry)) {
        await this.backUpInvalidFile();
        this.entries = [];
      } else {
        this.entries = parsed.slice(-MAX_HISTORY_ENTRIES);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.entries = [];
      } else if (error instanceof SyntaxError) {
        await this.backUpInvalidFile();
        this.entries = [];
      } else {
        throw error;
      }
    }
    return this.entries;
  }

  private async backUpInvalidFile(): Promise<void> {
    const backupPath = `${this.filePath}.invalid.${Date.now()}.bak`;
    await fs.rename(this.filePath, backupPath).catch(() => {});
  }

  private async writeAtomically(entries: PromptHistoryEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(entries), 'utf8');
      await fs.rename(temporaryPath, this.filePath);
    } finally {
      await fs.rm(temporaryPath, { force: true }).catch(() => {});
    }
  }
}
