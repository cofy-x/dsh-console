/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SessionMetrics,
  SessionTimingMetrics,
} from './session-metrics.js';
import type { PromptInputPart } from './prompt-input-runtime.js';
import type { ToolResultDisplay } from './tool-result.js';

export type ConversationRole = 'user' | 'assistant' | 'system';

export interface ConversationTextBlock {
  type: 'text';
  text: string;
}

export interface ConversationReasoningBlock {
  type: 'reasoning';
  text: string;
}

export interface ConversationImageBlock {
  type: 'image';
  attachment: {
    attachmentId: string;
    mediaType: string;
    bytes: number;
    width: number;
    height: number;
    name?: string;
    originalDimensions?: { width: number; height: number };
  };
}

export interface ConversationToolCallBlock {
  type: 'tool-call';
  id: string;
  name: string;
  arguments: string;
}

export interface ConversationExtensionBlock {
  type: 'extension';
  blockType: string;
  payload: unknown;
}

export type ConversationContentBlock =
  | ConversationTextBlock
  | ConversationReasoningBlock
  | ConversationImageBlock
  | ConversationToolCallBlock
  | ConversationExtensionBlock;

export interface ConversationContentMessage {
  turnMetrics?: ConversationTurnMetrics;
  id: string;
  role: ConversationRole;
  content: readonly ConversationContentBlock[];
  /** User-facing source text when model content was expanded before submission. */
  displayContent?: readonly ConversationContentBlock[];
  interrupted?: boolean;
  status?: 'error' | 'cancelled';
}

export interface ConversationTurnMetrics {
  durationMs: number;
  ttftMs?: number;
  tokensPerSecond?: number;
}

export interface ConversationToolResult {
  content: readonly ConversationContentBlock[];
  isError: boolean;
  error?: { name: string; code: string };
  /** Tool-owned, JSON-serializable presentation data from DSH. */
  meta?: unknown;
}

export type ConversationToolPresentation =
  | {
      kind: 'card';
      title?: string;
      description?: string;
      resultDisplay?: ToolResultDisplay;
    }
  | {
      kind: 'compact';
      label: string;
    };

export interface ConversationToolMessage {
  id: string;
  role: 'tool';
  callId: string;
  name: string;
  arguments: string;
  status: 'executing' | 'success' | 'error';
  result?: ConversationToolResult;
  presentation?: ConversationToolPresentation;
}

export type ConversationMessage =
  | ConversationContentMessage
  | ConversationToolMessage;

export interface ConversationTodo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ConversationSnapshot {
  messages: readonly ConversationMessage[];
  todos: readonly ConversationTodo[];
  busy: boolean;
}

export interface ConversationSessionStats {
  sessionId: string;
  metrics: SessionMetrics;
  timing?: SessionTimingMetrics;
  lastPromptTokenCount: number;
  contextWindow?: number;
}

export interface ConversationSubmission {
  content: readonly PromptInputPart[];
  displayContent: readonly PromptInputPart[];
  signal: AbortSignal;
}

export interface ConversationRuntime {
  getSnapshot: () => ConversationSnapshot;
  getSessionStats: () => ConversationSessionStats;
  subscribe: (listener: () => void) => () => void;
  submit: (submission: ConversationSubmission) => Promise<void>;
  cancel: () => void;
  exit: () => void;
}

export function conversationContentText(
  content: readonly ConversationContentBlock[],
): string {
  return content
    .map((block) => {
      switch (block.type) {
        case 'text':
          return block.text;
        case 'reasoning':
          return block.text;
        case 'image': {
          const label = block.attachment.name ?? block.attachment.attachmentId;
          return `[Image: ${label}, ${block.attachment.width}x${block.attachment.height}, ${block.attachment.mediaType}]`;
        }
        case 'tool-call':
          return '';
        case 'extension':
          return `[DSH content: ${block.blockType}]`;
        default:
          return '';
      }
    })
    .filter((value) => value !== '')
    .join('\n\n');
}

export function conversationMessageText(
  message: ConversationContentMessage,
): string {
  return conversationContentText(message.displayContent ?? message.content);
}
