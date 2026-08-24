/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { debugLogger } from '@cofy-x/dsh-console-core';
import type { TextBuffer } from '../input/use-text-buffer.js';
import type { PromptCompletionRuntime } from '../../prompt-completion-runtime.js';
import { isSlashCommand } from '../../commands/utils.js';

export const PROMPT_COMPLETION_MIN_LENGTH = 5;
export const PROMPT_COMPLETION_DEBOUNCE_MS = 250;

export interface PromptCompletion {
  text: string;
  isLoading: boolean;
  isActive: boolean;
  accept: () => void;
  clear: () => void;
  markSelected: (selectedText: string) => void;
}

export interface UsePromptCompletionOptions {
  buffer: TextBuffer;
  completePrompt?: PromptCompletionRuntime['complete'];
  enabled: boolean;
}

export function usePromptCompletion({
  buffer,
  completePrompt,
  enabled,
}: UsePromptCompletionOptions): PromptCompletion {
  const [ghostText, setGhostText] = useState<string>('');
  const [isLoadingGhostText, setIsLoadingGhostText] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [justSelectedSuggestion, setJustSelectedSuggestion] =
    useState<boolean>(false);
  const lastSelectedTextRef = useRef<string>('');
  const lastRequestedTextRef = useRef<string>('');

  const isPromptCompletionEnabled = enabled && completePrompt !== undefined;

  const clearGhostText = useCallback(() => {
    setGhostText('');
    setIsLoadingGhostText(false);
  }, []);

  const acceptGhostText = useCallback(() => {
    if (ghostText && ghostText.length > buffer.text.length) {
      buffer.setText(ghostText);
      setGhostText('');
      setJustSelectedSuggestion(true);
      lastSelectedTextRef.current = ghostText;
    }
  }, [ghostText, buffer]);

  const markSuggestionSelected = useCallback((selectedText: string) => {
    setJustSelectedSuggestion(true);
    lastSelectedTextRef.current = selectedText;
  }, []);

  const generatePromptSuggestions = useCallback(async () => {
    const trimmedText = buffer.text.trim();
    if (trimmedText === lastRequestedTextRef.current) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (
      trimmedText.length < PROMPT_COMPLETION_MIN_LENGTH ||
      !completePrompt ||
      isSlashCommand(trimmedText) ||
      trimmedText.includes('@') ||
      !isPromptCompletionEnabled
    ) {
      clearGhostText();
      lastRequestedTextRef.current = '';
      return;
    }

    lastRequestedTextRef.current = trimmedText;
    setIsLoadingGhostText(true);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const responseText = await completePrompt(trimmedText, signal);

      if (signal.aborted) {
        return;
      }

      if (responseText) {
        const suggestionText = responseText.trim();

        if (
          suggestionText.length > 0 &&
          suggestionText.startsWith(trimmedText)
        ) {
          setGhostText(suggestionText);
        } else {
          clearGhostText();
        }
      }
    } catch (error) {
      if (
        !(
          signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        )
      ) {
        debugLogger.debug(
          `Prompt completion failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      clearGhostText();
    } finally {
      if (!signal.aborted) {
        setIsLoadingGhostText(false);
      }
    }
  }, [
    buffer.text,
    completePrompt,
    clearGhostText,
    isPromptCompletionEnabled,
  ]);

  const isCursorAtEnd = useCallback(() => {
    const [cursorRow, cursorCol] = buffer.cursor;
    const totalLines = buffer.lines.length;
    if (cursorRow !== totalLines - 1) {
      return false;
    }

    const lastLine = buffer.lines[cursorRow] || '';
    return cursorCol === lastLine.length;
  }, [buffer.cursor, buffer.lines]);

  const handlePromptCompletion = useCallback(() => {
    if (!isCursorAtEnd()) {
      clearGhostText();
      return;
    }

    const trimmedText = buffer.text.trim();

    if (justSelectedSuggestion && trimmedText === lastSelectedTextRef.current) {
      return;
    }

    if (trimmedText !== lastSelectedTextRef.current) {
      setJustSelectedSuggestion(false);
      lastSelectedTextRef.current = '';
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    generatePromptSuggestions();
  }, [
    buffer.text,
    generatePromptSuggestions,
    justSelectedSuggestion,
    isCursorAtEnd,
    clearGhostText,
  ]);

  // Debounce prompt completion
  useEffect(() => {
    const timeoutId = setTimeout(
      handlePromptCompletion,
      PROMPT_COMPLETION_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeoutId);
  }, [buffer.text, buffer.cursor, handlePromptCompletion]);

  // Ghost text validation - clear if it doesn't match current text or cursor not at end
  useEffect(() => {
    const currentText = buffer.text.trim();

    if (ghostText && !isCursorAtEnd()) {
      clearGhostText();
      return;
    }

    if (
      ghostText &&
      currentText.length > 0 &&
      !ghostText.startsWith(currentText)
    ) {
      clearGhostText();
    }
  }, [buffer.text, buffer.cursor, ghostText, clearGhostText, isCursorAtEnd]);

  // Cleanup on unmount
  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const isActive = useMemo(() => {
    if (!isPromptCompletionEnabled) return false;

    if (!isCursorAtEnd()) return false;

    const trimmedText = buffer.text.trim();
    return (
      trimmedText.length >= PROMPT_COMPLETION_MIN_LENGTH &&
      !isSlashCommand(trimmedText) &&
      !trimmedText.includes('@')
    );
  }, [buffer.text, isPromptCompletionEnabled, isCursorAtEnd]);

  return {
    text: ghostText,
    isLoading: isLoadingGhostText,
    isActive,
    accept: acceptGhostText,
    clear: clearGhostText,
    markSelected: markSuggestionSelected,
  };
}
