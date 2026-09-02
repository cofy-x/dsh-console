/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  conversationMessageText,
  type ConversationMessage,
} from './conversation-runtime.js';
import {
  MessageType,
  ToolCallStatus,
  type HistoryItemWithoutId,
} from './types.js';

export function projectedToolCallIds(
  messages: readonly ConversationMessage[],
): ReadonlySet<string> {
  return new Set(
    messages.flatMap((message) =>
      message.role === 'tool' ? [message.callId] : [],
    ),
  );
}

export function conversationMessageToHistoryItem(
  message: ConversationMessage,
  visibleToolCallIds: ReadonlySet<string>,
): HistoryItemWithoutId | undefined {
  const assistantContent =
    message.role === 'assistant'
      ? message.content.filter(
          (block) =>
            block.type !== 'tool-call' || !visibleToolCallIds.has(block.id),
        )
      : undefined;
  if (
    message.role === 'assistant' &&
    assistantContent?.length === 0 &&
    message.interrupted !== true
  ) {
    return undefined;
  }
  if (message.role === 'tool') {
    return {
      type: 'tool_group',
      tools: [
        {
          callId: message.callId,
          name:
            message.presentation?.kind === 'card'
              ? (message.presentation.title ?? message.name)
              : message.name,
          description:
            message.presentation?.kind === 'compact'
              ? ''
              : (message.presentation?.description ?? message.arguments),
          arguments: message.arguments,
          resultDisplay:
            message.presentation?.kind === 'compact'
              ? undefined
              : (message.presentation?.resultDisplay ??
                (message.result === undefined
                  ? undefined
                  : {
                      type: 'dsh-content' as const,
                      content: message.result.content,
                      ...(message.result.error === undefined
                        ? {}
                        : { error: message.result.error }),
                    })),
          ...(message.presentation?.kind === 'compact'
            ? {
                presentation: {
                  kind: 'compact' as const,
                  label: message.presentation.label,
                },
              }
            : {}),
          status:
            message.status === 'executing'
              ? ToolCallStatus.Executing
              : message.status === 'success'
                ? ToolCallStatus.Success
                : ToolCallStatus.Error,
        },
      ],
    };
  }
  if (message.role === 'assistant') {
    return {
      type: 'dsh_assistant',
      content: assistantContent ?? message.content,
      interrupted: message.interrupted === true,
      ...(message.turnMetrics === undefined
        ? {}
        : { turnMetrics: message.turnMetrics }),
    };
  }
  if (message.role === 'user') {
    return {
      type: 'dsh_user',
      content: message.displayContent ?? message.content,
    };
  }
  return {
    type:
      message.status === 'cancelled' ? MessageType.WARNING : MessageType.ERROR,
    text: conversationMessageText(message),
  };
}

export function conversationMessageFingerprint(
  message: ConversationMessage,
  item: HistoryItemWithoutId,
): string {
  if (message.role === 'tool') {
    return JSON.stringify([
      message.status,
      message.arguments,
      message.result,
      message.presentation,
    ]);
  }
  if (message.role === 'assistant' && item.type === 'dsh_assistant') {
    return JSON.stringify([item.content, item.interrupted, item.turnMetrics]);
  }
  if (message.role === 'user') {
    return JSON.stringify(message.displayContent ?? message.content);
  }
  return conversationMessageText(message);
}
