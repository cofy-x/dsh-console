/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '@cofy-x/dsh-console-core';
import { useCallback, useRef, useState } from 'react';

interface PromptHistoryReader {
  read(): Promise<string[]>;
}

export interface UseInputHistoryStoreReturn {
  inputHistory: string[];
  addInput: (input: string) => void;
  initializeFromHistory: (history: PromptHistoryReader) => Promise<void>;
}

function deduplicateConsecutive(messages: string[]): string[] {
  return messages.filter(
    (message, index) => index === 0 || message !== messages[index - 1],
  );
}

/**
 * Hook for independently managing input history.
 * Completely separated from chat history and unaffected by /clear commands.
 */
export function useInputHistoryStore(): UseInputHistoryStoreReturn {
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const initializationStarted = useRef(false);

  /**
   * Merge persisted prompt history once at app startup.
   */
  const initializeFromHistory = useCallback(
    async (history: PromptHistoryReader) => {
      if (initializationStarted.current) return;
      initializationStarted.current = true;

      try {
        const persistedNewestFirst = await history.read();
        const persistedOldestFirst = deduplicateConsecutive(
          persistedNewestFirst,
        ).reverse();
        setInputHistory((currentRun) =>
          deduplicateConsecutive([...persistedOldestFirst, ...currentRun]),
        );
      } catch (error) {
        debugLogger.warn(
          'Failed to initialize prompt history:',
          error,
        );
      }
    },
    [],
  );

  /**
   * Add new input to history.
   * Recalculates the entire history with deduplication.
   */
  const addInput = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) return; // Filter empty/whitespace-only inputs

      setInputHistory((history) =>
        history.at(-1) === trimmedInput
          ? history
          : [...history, trimmedInput],
      );
    },
    [],
  );

  return {
    inputHistory,
    addInput,
    initializeFromHistory,
  };
}
