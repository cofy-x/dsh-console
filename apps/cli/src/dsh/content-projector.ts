/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContentBlock } from '@deepseek-ai/dsh-llm';
import type { ConversationContentBlock } from '../ui/conversation-runtime.js';

export function projectDshContentBlock(
  block: ContentBlock,
): ConversationContentBlock {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'reasoning':
      return { type: 'reasoning', text: block.text };
    case 'image':
      return {
        type: 'image',
        attachment: {
          ...block.attachment,
          attachmentId: String(block.attachment.attachmentId),
        },
      };
    case 'tool-call':
      return {
        type: 'tool-call',
        id: String(block.id),
        name: block.name,
        arguments: block.arguments,
      };
    case 'tool-result':
      return {
        type: 'extension',
        blockType: block.type,
        payload: block,
      };
    default: {
      const extension = block as ContentBlock & { type: string };
      return {
        type: 'extension',
        blockType: extension.type,
        payload: extension,
      };
    }
  }
}

export function projectDshContent(
  content: readonly ContentBlock[],
): ConversationContentBlock[] {
  return content.map(projectDshContentBlock);
}
