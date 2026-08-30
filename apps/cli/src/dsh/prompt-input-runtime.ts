/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  PreparedPromptInput,
  PromptImageSourcePart,
  PromptInputPart,
  PromptInputRequest,
  PromptInputRuntime,
} from '../ui/prompt-input-runtime.js';

const MAX_FILES = 50;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const REFERENCE_START = '<reference_content>';
const REFERENCE_END = '</reference_content>';
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules']);
const IMAGE_MEDIA_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
] as const);
const UNSUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  '.pdf',
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.mp4',
  '.mov',
  '.avi',
  '.webm',
]);

interface ParsedReference {
  value: string;
  start: number;
  end: number;
}

interface ResolvedReference {
  path: string;
  kind: PromptImageSourcePart['source']['kind'];
}

function abortError(): Error {
  const error = new Error('Prompt preparation cancelled.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function parseReferences(text: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '@' || (index > 0 && !/\s/.test(text[index - 1])))
      continue;
    let cursor = index + 1;
    let value = '';
    let escaped = false;
    while (cursor < text.length) {
      const character = text[cursor];
      if (escaped) {
        value += character;
        escaped = false;
      } else if (character === '\\') {
        // Backslashes are path separators on Windows. Treat one as an escape
        // only when it quotes a character that would otherwise end a reference.
        const next = text[cursor + 1];
        if (next !== undefined && /[,\s;!()[\]{}]/.test(next)) escaped = true;
        else value += character;
      } else if (/[,\s;!?()[\]{}]/.test(character)) {
        break;
      } else {
        value += character;
      }
      cursor += 1;
    }
    if (value !== '') references.push({ value, start: index, end: cursor });
    index = Math.max(index, cursor - 1);
  }
  return references;
}

async function resolveReference(
  value: string,
  workspaceRoots: readonly string[],
  clipboardRoots: readonly string[],
): Promise<ResolvedReference | undefined> {
  const candidates = path.isAbsolute(value)
    ? [path.resolve(value)]
    : workspaceRoots.map((root) => path.resolve(root, value));
  const isAllowedLexically = candidates.some(
    (candidate) =>
      workspaceRoots.some((root) => isWithin(root, candidate)) ||
      clipboardRoots.some((root) => isWithin(root, candidate)),
  );
  if (!isAllowedLexically)
    throw new Error(`File reference is outside the workspace: @${value}`);

  for (const candidate of candidates) {
    try {
      const realCandidate = await fs.realpath(candidate);
      const workspaceRoot = workspaceRoots.find((root) =>
        isWithin(root, realCandidate),
      );
      if (workspaceRoot) return { path: realCandidate, kind: 'workspace-file' };
      const clipboardRoot = clipboardRoots.find((root) =>
        isWithin(root, realCandidate),
      );
      if (clipboardRoot) return { path: realCandidate, kind: 'clipboard-file' };
      throw new Error(`File reference is outside the workspace: @${value}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
  return undefined;
}

async function collectFiles(
  candidate: string,
  root: string,
  signal: AbortSignal,
  output: string[],
): Promise<void> {
  throwIfAborted(signal);
  if (output.length >= MAX_FILES) return;
  const stats = await fs.lstat(candidate);
  if (stats.isSymbolicLink()) return;
  if (stats.isFile()) {
    if (!IMAGE_MEDIA_TYPES.has(path.extname(candidate).toLowerCase() as never))
      output.push(candidate);
    return;
  }
  if (!stats.isDirectory()) return;
  const entries = await fs.readdir(candidate, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (output.length >= MAX_FILES) return;
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const child = path.join(candidate, entry.name);
    if (isWithin(root, child)) await collectFiles(child, root, signal, output);
  }
}

function appendText(parts: PromptInputPart[], text: string): void {
  if (text === '') return;
  const last = parts.at(-1);
  if (last?.type === 'text') last.text += text;
  else parts.push({ type: 'text', text });
}

export class WorkspacePromptInputRuntime implements PromptInputRuntime {
  private disposed = false;

  async prepare({
    text,
    workspaceRoots,
    clipboardImageRoots,
    signal,
  }: PromptInputRequest): Promise<PreparedPromptInput> {
    if (this.disposed)
      throw new Error('Prompt input runtime has been disposed.');
    throwIfAborted(signal);

    const roots = await Promise.all(
      workspaceRoots.map((root) => fs.realpath(root)),
    );
    const clipboardRoots = await Promise.all(
      clipboardImageRoots.map(async (root) => {
        try {
          return await fs.realpath(root);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return path.resolve(root);
          throw error;
        }
      }),
    );
    const references = parseReferences(text);
    const images = new Map<number, PromptImageSourcePart>();
    const textFiles: Array<{ file: string; root: string }> = [];

    for (const reference of references) {
      throwIfAborted(signal);
      const resolved = await resolveReference(
        reference.value,
        roots,
        clipboardRoots,
      );
      if (!resolved) continue;
      const stats = await fs.stat(resolved.path);
      const extension = path.extname(resolved.path).toLowerCase();
      const mediaType = IMAGE_MEDIA_TYPES.get(extension as never);
      if (stats.isFile() && mediaType) {
        images.set(reference.start, {
          type: 'image-source',
          source: { kind: resolved.kind, path: resolved.path },
          displayName: path.basename(resolved.path),
          declaredMediaType: mediaType,
        });
        continue;
      }
      if (stats.isFile() && UNSUPPORTED_ATTACHMENT_EXTENSIONS.has(extension)) {
        throw new Error(
          `Unsupported attachment type: ${extension.slice(1) || 'binary file'}`,
        );
      }
      if (resolved.kind === 'clipboard-file') {
        throw new Error(
          'Clipboard attachments must be PNG, JPEG, WebP, or GIF images.',
        );
      }
      const root = roots.find((candidate) =>
        isWithin(candidate, resolved.path),
      );
      if (!root)
        throw new Error(
          `File reference is outside the workspace: @${reference.value}`,
        );
      if (stats.isFile()) {
        if (stats.size > MAX_FILE_BYTES) {
          throw new Error(
            `Referenced text file is too large: @${reference.value}`,
          );
        }
        const candidate = await fs.readFile(resolved.path, { signal });
        try {
          if (candidate.includes(0)) throw new Error('binary');
          new TextDecoder('utf-8', { fatal: true }).decode(candidate);
        } catch {
          throw new Error(`Unsupported binary attachment: @${reference.value}`);
        }
      }
      const collected: string[] = [];
      await collectFiles(resolved.path, root, signal, collected);
      textFiles.push(...collected.map((file) => ({ file, root })));
    }

    const displayContent: PromptInputPart[] = [];
    let cursor = 0;
    for (const reference of references) {
      const image = images.get(reference.start);
      if (!image) continue;
      appendText(displayContent, text.slice(cursor, reference.start));
      displayContent.push(image);
      cursor = reference.end;
    }
    appendText(displayContent, text.slice(cursor));
    if (displayContent.length === 0)
      displayContent.push({ type: 'text', text });

    const uniqueFiles = [
      ...new Map(textFiles.map((entry) => [entry.file, entry])).values(),
    ].slice(0, MAX_FILES);
    const sections: string[] = [];
    let totalBytes = 0;
    for (const { file, root } of uniqueFiles) {
      throwIfAborted(signal);
      const stats = await fs.stat(file);
      if (
        stats.size > MAX_FILE_BYTES ||
        totalBytes + stats.size > MAX_TOTAL_BYTES
      )
        continue;
      const buffer = await fs.readFile(file, { signal });
      if (buffer.includes(0)) continue;
      let content: string;
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        continue;
      }
      totalBytes += stats.size;
      const label = path.relative(root, file).split(path.sep).join('/');
      sections.push(`Content from @${label}:\n${content}`);
    }

    const content = displayContent.map((part) =>
      part.type === 'text' ? { ...part } : part,
    );
    if (sections.length > 0) {
      appendText(
        content,
        `\n\n${REFERENCE_START}\n${sections.join('\n\n')}\n${REFERENCE_END}`,
      );
    }
    return { content, displayContent };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}
