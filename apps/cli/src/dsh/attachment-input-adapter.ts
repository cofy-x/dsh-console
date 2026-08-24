/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import { isImageAdmissionError } from '@deepseek-ai/dsh-attachment';
import type { AttachmentStore, ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import { debugLogger } from '@cofy-x/dsh-console-core';
import type {
  PromptImageSourcePart,
  PromptInputPart,
} from '../ui/prompt-input-runtime.js';

export interface IngestedPromptInput {
  content: readonly ContentBlock[];
  displayContent: readonly ContentBlock[];
  clipboardFiles: readonly string[];
}

const IMAGE_MEDIA_TYPES = new Set<ImageMediaType>([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
]);

function imageMediaType(value: string): ImageMediaType {
  if (IMAGE_MEDIA_TYPES.has(value as ImageMediaType)) return value as ImageMediaType;
  throw new Error(`Unsupported image media type: ${value}`);
}

function imageParts(parts: readonly PromptInputPart[]): PromptImageSourcePart[] {
  return parts.filter((part): part is PromptImageSourcePart => part.type === 'image-source');
}

function canonicalContent(
  parts: readonly PromptInputPart[],
  refs: readonly ImageAttachmentRef[],
): ContentBlock[] {
  let imageIndex = 0;
  return parts.map((part): ContentBlock => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    const attachment = refs[imageIndex++];
    if (!attachment) throw new Error('DSH attachment service returned an incomplete image batch.');
    return { type: 'image', attachment };
  });
}

export class DshAttachmentInputAdapter {
  constructor(private readonly attachments: Pick<AttachmentStore, 'saveImages'>) {}

  async ingest(
    content: readonly PromptInputPart[],
    displayContent: readonly PromptInputPart[],
    signal: AbortSignal,
  ): Promise<IngestedPromptInput> {
    try {
      signal.throwIfAborted();
      const images = imageParts(content);
      const inputs = await Promise.all(images.map(async (part) => ({
        data: new Uint8Array(await fs.readFile(part.source.path, { signal })),
        mediaType: imageMediaType(part.declaredMediaType),
        name: part.displayName,
      })));
      signal.throwIfAborted();
      const refs = inputs.length === 0 ? [] : await this.attachments.saveImages(inputs);
      signal.throwIfAborted();
      if (refs.length !== images.length) {
        throw new Error('DSH attachment service returned an incomplete image batch.');
      }
      return {
        content: canonicalContent(content, refs),
        displayContent: canonicalContent(displayContent, refs),
        clipboardFiles: [...new Set(images
          .filter((part) => part.source.kind === 'clipboard-file')
          .map((part) => part.source.path))],
      };
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      if (isImageAdmissionError(error)) throw new Error(error.message, { cause: error });
      debugLogger.debug(`DSH attachment ingestion failed: ${String(error)}`);
      throw new Error('Unable to prepare image attachments.', { cause: error });
    }
  }
}
