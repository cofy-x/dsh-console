/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StreamingState } from '../../types.js';

export interface UseMessageQueueOptions {
  queueKey: string;
  streamingState: StreamingState;
  submitQuery: (query: string) => void;
}

export interface UseMessageQueueReturn {
  messageQueue: string[];
  addMessage: (message: string) => void;
  clearQueue: () => void;
  getQueuedMessagesText: () => string;
  popAllMessages: () => string | undefined;
}

/**
 * Hook for managing message queuing during streaming responses.
 * Allows users to queue messages while the AI is responding and automatically
 * sends them when streaming completes.
 */
export function useMessageQueue({
  queueKey,
  streamingState,
  submitQuery,
}: UseMessageQueueOptions): UseMessageQueueReturn {
  const [queuedMessages, setQueuedMessages] = useState<
    Array<{ key: string; message: string }>
  >([]);
  const messageQueue = useMemo(
    () =>
      queuedMessages
        .filter((entry) => entry.key === queueKey)
        .map((entry) => entry.message),
    [queueKey, queuedMessages],
  );

  // Add a message to the queue
  const addMessage = useCallback((message: string) => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 0) {
      setQueuedMessages((previous) => [
        ...previous,
        { key: queueKey, message: trimmedMessage },
      ]);
    }
  }, [queueKey]);

  // Clear the entire queue
  const clearQueue = useCallback(() => {
    setQueuedMessages((previous) =>
      previous.filter((entry) => entry.key !== queueKey),
    );
  }, [queueKey]);

  // Get all queued messages as a single text string
  const getQueuedMessagesText = useCallback(() => {
    if (messageQueue.length === 0) return '';
    return messageQueue.join('\n\n');
  }, [messageQueue]);

  // Pop all messages from the queue and return them as a single string
  const popAllMessages = useCallback(() => {
    if (messageQueue.length === 0) {
      return undefined;
    }
    const allMessages = messageQueue.join('\n\n');
    setQueuedMessages((previous) =>
      previous.filter((entry) => entry.key !== queueKey),
    );
    return allMessages;
  }, [messageQueue, queueKey]);

  // Process queued messages when streaming becomes idle
  useEffect(() => {
    if (streamingState === StreamingState.Idle && messageQueue.length > 0) {
      // Combine all messages with double newlines for clarity
      const combinedMessage = messageQueue.join('\n\n');
      // Clear the queue and submit
      setQueuedMessages((previous) =>
        previous.filter((entry) => entry.key !== queueKey),
      );
      submitQuery(combinedMessage);
    }
  }, [streamingState, messageQueue, queueKey, submitQuery]);

  return {
    messageQueue,
    addMessage,
    clearQueue,
    getQueuedMessagesText,
    popAllMessages,
  };
}
