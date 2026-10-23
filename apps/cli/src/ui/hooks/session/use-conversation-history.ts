/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import type { ConversationSnapshot } from '../../conversation-runtime.js';
import {
  conversationMessageFingerprint,
  conversationMessageToHistoryItem,
  projectedToolCallIds,
} from '../../conversation-history-projector.js';
import type { UseHistoryManagerReturn } from './use-history-manager.js';

/** Project canonical messages while keeping an active Turn out of Ink Static. */
export function useConversationHistory(
  sessionId: string,
  snapshot: ConversationSnapshot,
  manager: UseHistoryManagerReturn,
): number | undefined {
  const ids = useRef(new Map<string, number>());
  const fingerprints = useRef(new Map<string, string>());
  const [projectedSessionId, setProjectedSessionId] = useState(sessionId);
  const [pendingHistoryStart, setPendingHistoryStart] = useState<number>();
  const { history, addItem, updateItem, clearItems, loadHistory } = manager;

  useEffect(() => {
    if (projectedSessionId !== sessionId) {
      ids.current.clear();
      fingerprints.current.clear();
      clearItems();
      setPendingHistoryStart(undefined);
      setProjectedSessionId(sessionId);
      return;
    }

    // Batch the render split with the corresponding history updates. On idle,
    // Static receives the final content and tool states in the same commit.
    const pendingStart = snapshot.busy
      ? Math.min(pendingHistoryStart ?? history.length, history.length)
      : undefined;
    if (pendingStart !== pendingHistoryStart) {
      setPendingHistoryStart(pendingStart);
    }
    const visibleToolCallIds = projectedToolCallIds(snapshot.messages);
    const projected = snapshot.messages.flatMap((message) => {
      const item = conversationMessageToHistoryItem(
        message,
        visibleToolCallIds,
      );
      return item === undefined ? [] : [{ message, item }];
    });
    const projectedIds = new Set(projected.map(({ message }) => message.id));
    const removedIds = new Set<number>();
    for (const [messageId, historyId] of ids.current) {
      if (!projectedIds.has(messageId)) {
        removedIds.add(historyId);
        ids.current.delete(messageId);
        fingerprints.current.delete(messageId);
      }
    }
    if (removedIds.size > 0) {
      loadHistory(history.filter((item) => !removedIds.has(item.id)));
    }
    const visibleHistoryIds = new Set(history.map((item) => item.id));
    for (const { message, item } of projected) {
      const historyId = ids.current.get(message.id);
      const fingerprint = conversationMessageFingerprint(message, item);
      if (historyId === undefined || !visibleHistoryIds.has(historyId)) {
        const nextHistoryId = addItem(item);
        ids.current.set(message.id, nextHistoryId);
        fingerprints.current.set(message.id, fingerprint);
        visibleHistoryIds.add(nextHistoryId);
      } else if (fingerprints.current.get(message.id) !== fingerprint) {
        updateItem(historyId, item);
        fingerprints.current.set(message.id, fingerprint);
      }
    }
  }, [
    sessionId,
    projectedSessionId,
    snapshot.messages,
    snapshot.busy,
    pendingHistoryStart,
    history,
    addItem,
    updateItem,
    clearItems,
    loadHistory,
  ]);

  return pendingHistoryStart;
}
