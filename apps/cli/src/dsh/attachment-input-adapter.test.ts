/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AttachmentId, type ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DshAttachmentInputAdapter } from './attachment-input-adapter.js';

describe('DshAttachmentInputAdapter', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'dsh-console-ingest-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('saves one ordered batch and creates canonical image blocks', async () => {
    const first = path.join(root, 'first.png');
    const second = path.join(root, 'second.jpg');
    await Promise.all([writeFile(first, 'first'), writeFile(second, 'second')]);
    const refs: ImageAttachmentRef[] = [
      { attachmentId: AttachmentId(`sha256:${'a'.repeat(64)}`), mediaType: 'image/png', bytes: 5, width: 1, height: 1, name: 'first.png' },
      { attachmentId: AttachmentId(`sha256:${'b'.repeat(64)}`), mediaType: 'image/jpeg', bytes: 6, width: 2, height: 2, name: 'second.jpg' },
    ];
    const saveImages = vi.fn().mockResolvedValue(refs);
    const adapter = new DshAttachmentInputAdapter({ saveImages });
    const image = (file: string, mediaType: string, kind: 'workspace-file' | 'clipboard-file') => ({
      type: 'image-source' as const,
      source: { kind, path: file },
      displayName: path.basename(file),
      declaredMediaType: mediaType,
    });
    const result = await adapter.ingest(
      [{ type: 'text', text: 'A' }, image(first, 'image/png', 'workspace-file'), image(second, 'image/jpeg', 'clipboard-file')],
      [{ type: 'text', text: 'A' }, image(first, 'image/png', 'workspace-file'), image(second, 'image/jpeg', 'clipboard-file')],
      new AbortController().signal,
    );
    expect(saveImages).toHaveBeenCalledOnce();
    expect(saveImages.mock.calls[0][0]).toMatchObject([
      { mediaType: 'image/png', name: 'first.png' },
      { mediaType: 'image/jpeg', name: 'second.jpg' },
    ]);
    expect(result.content.map((block) => block.type)).toEqual(['text', 'image', 'image']);
    expect(result.clipboardFiles).toEqual([second]);
  });

  it('does not call the store for text-only input', async () => {
    const saveImages = vi.fn();
    const adapter = new DshAttachmentInputAdapter({ saveImages });
    await expect(adapter.ingest(
      [{ type: 'text', text: 'hello' }],
      [{ type: 'text', text: 'hello' }],
      new AbortController().signal,
    )).resolves.toMatchObject({ content: [{ type: 'text', text: 'hello' }] });
    expect(saveImages).not.toHaveBeenCalled();
  });

  it('discards a completed save when cancellation wins the race', async () => {
    let resolveSave!: (value: ImageAttachmentRef[]) => void;
    const saveImages = vi.fn(() => new Promise<ImageAttachmentRef[]>((resolve) => { resolveSave = resolve; }));
    const file = path.join(root, 'image.png');
    await writeFile(file, 'image');
    const controller = new AbortController();
    const result = new DshAttachmentInputAdapter({ saveImages }).ingest([{
      type: 'image-source',
      source: { kind: 'workspace-file', path: file },
      displayName: 'image.png',
      declaredMediaType: 'image/png',
    }], [], controller.signal);
    await vi.waitFor(() => expect(saveImages).toHaveBeenCalled());
    controller.abort();
    resolveSave([{ attachmentId: AttachmentId(`sha256:${'c'.repeat(64)}`), mediaType: 'image/png', bytes: 5, width: 1, height: 1 }]);
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });
});
