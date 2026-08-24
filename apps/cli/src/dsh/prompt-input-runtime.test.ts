/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspacePromptInputRuntime } from './prompt-input-runtime.js';

describe('WorkspacePromptInputRuntime', () => {
  let root: string;
  let clipboardRoot: string;
  let runtime: WorkspacePromptInputRuntime;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'dsh-console-input-'));
    clipboardRoot = await mkdtemp(path.join(tmpdir(), 'dsh-console-clipboard-'));
    runtime = new WorkspacePromptInputRuntime();
  });

  afterEach(async () => {
    await runtime.dispose();
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(clipboardRoot, { recursive: true, force: true }),
    ]);
  });

  const prepare = (text: string, signal = new AbortController().signal) => runtime.prepare({
    text,
    workspaceRoots: [root],
    clipboardImageRoots: [clipboardRoot],
    signal,
  });

  it('returns prompts without references unchanged', async () => {
    await expect(prepare('email user@example.com')).resolves.toEqual({
      content: [{ type: 'text', text: 'email user@example.com' }],
      displayContent: [{ type: 'text', text: 'email user@example.com' }],
    });
  });

  it('preserves ordered text and image sources', async () => {
    await Promise.all([
      writeFile(path.join(root, 'first.png'), 'first'),
      writeFile(path.join(root, 'second image.jpg'), 'second'),
    ]);
    const result = await prepare('Compare @first.png with @second\\ image.jpg now');
    expect(result.content.map((part) => part.type)).toEqual([
      'text', 'image-source', 'text', 'image-source', 'text',
    ]);
    expect(result.content[1]).toMatchObject({
      source: { kind: 'workspace-file' },
      declaredMediaType: 'image/png',
    });
  });

  it('accepts only owned clipboard image paths outside the workspace', async () => {
    const image = path.join(clipboardRoot, 'clipboard.png');
    await writeFile(image, 'image');
    const relative = path.relative(root, image).replaceAll(' ', '\\ ');
    const result = await prepare(`Inspect @${relative}`);
    expect(result.content[1]).toMatchObject({
      source: { kind: 'clipboard-file', path: await realpath(image) },
    });
  });

  it('appends text context and skips images in directories', async () => {
    await mkdir(path.join(root, 'context'));
    await Promise.all([
      writeFile(path.join(root, 'context', 'notes.txt'), 'hello'),
      writeFile(path.join(root, 'context', 'ignored.png'), 'image'),
    ]);
    const result = await prepare('Review @context');
    expect(result.content).toEqual([{
      type: 'text',
      text: expect.stringContaining('Content from @context/notes.txt:\nhello'),
    }]);
    expect(JSON.stringify(result)).not.toContain('ignored.png');
  });

  it('rejects unsupported attachments and paths outside trusted roots', async () => {
    await writeFile(path.join(root, 'document.pdf'), 'pdf');
    await writeFile(path.join(root, 'data.bin'), Buffer.from([0, 1, 2]));
    await expect(prepare('Read @document.pdf')).rejects.toThrow('Unsupported attachment type: pdf');
    await expect(prepare('Read @data.bin')).rejects.toThrow('Unsupported binary attachment');
    await expect(prepare('Read @../secret.png')).rejects.toThrow('outside the workspace');
  });

  it('preserves repeated image occurrences', async () => {
    await writeFile(path.join(root, 'same.png'), 'image');
    const result = await prepare('Compare @same.png and @same.png');
    expect(result.content.filter((part) => part.type === 'image-source')).toHaveLength(2);
  });

  it('rejects symlinks escaping the workspace', async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), 'dsh-console-untrusted-'));
    try {
      const outside = path.join(outsideRoot, 'outside.txt');
      await writeFile(outside, 'secret');
      await symlink(outside, path.join(root, 'linked.txt'));
      await expect(prepare('Read @linked.txt')).rejects.toThrow('outside the workspace');
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(prepare('@notes.txt', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
