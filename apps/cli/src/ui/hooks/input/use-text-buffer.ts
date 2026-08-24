/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import pathMod from 'node:path';
import { useState, useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  coreEvents,
  CoreEvent,
  type EditorType,
  getEditorCommand,
  isGuiEditor,
} from '@cofy-x/dsh-console-core';
import type { Key } from '../../../terminal/keys.js';
import {
  toCodePoints,
  getCachedStringWidth,
  cpLen,
} from '../../../text/processing.js';
import { parsePastedPaths } from '../../../terminal/clipboard/index.js';
import {
  PASTED_TEXT_PLACEHOLDER_REGEX,
  type Direction,
  type ExpandedPasteInfo,
  type TextBufferAction,
  type TextBufferState,
  type Transformation,
  type VisualLayout,
} from '../../input/buffer/types.js';
import {
  calculateInitialCursorPosition,
  calculateLayout,
  calculateTransformations,
  calculateVisualCursorFromLayout,
  clamp,
  getExpandedPasteAtLine,
  logicalPosToOffset,
  offsetToLogicalPos,
} from '../../input/buffer/utils.js';
import { textBufferReducer } from '../../input/buffer/reducer.js';
import { Command, keyMatchers } from '../../input/key-matchers.js';

export interface Viewport {
  height: number;
  width: number;
}

interface UseTextBufferProps {
  initialText?: string;
  initialCursorOffset?: number;
  viewport: Viewport; // Viewport dimensions needed for scrolling
  stdin?: NodeJS.ReadStream | null; // For external editor
  setRawMode?: (mode: boolean) => void; // For external editor
  onChange?: (text: string) => void; // Callback for when text changes
  isValidPath: (path: string) => boolean;
  shellModeActive?: boolean; // Whether the text buffer is in shell mode
  inputFilter?: (text: string) => string; // Optional filter for input text
  singleLine?: boolean;
  getPreferredEditor?: () => EditorType | undefined;
}

export function useTextBuffer({
  initialText = '',
  initialCursorOffset = 0,
  viewport,
  stdin,
  setRawMode,
  onChange,
  isValidPath,
  shellModeActive = false,
  inputFilter,
  singleLine = false,
  getPreferredEditor,
}: UseTextBufferProps): TextBuffer {
  const initialState = useMemo((): TextBufferState => {
    const lines = initialText.split('\n');
    const [initialCursorRow, initialCursorCol] = calculateInitialCursorPosition(
      lines.length === 0 ? [''] : lines,
      initialCursorOffset,
    );
    const transformationsByLine = calculateTransformations(
      lines.length === 0 ? [''] : lines,
    );
    const visualLayout = calculateLayout(
      lines.length === 0 ? [''] : lines,
      viewport.width,
      [initialCursorRow, initialCursorCol],
    );
    return {
      lines: lines.length === 0 ? [''] : lines,
      cursorRow: initialCursorRow,
      cursorCol: initialCursorCol,
      transformationsByLine,
      preferredCol: null,
      undoStack: [],
      redoStack: [],
      clipboard: null,
      selectionAnchor: null,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      visualLayout,
      pastedContent: {},
      expandedPaste: null,
    };
  }, [initialText, initialCursorOffset, viewport.width, viewport.height]);

  const [state, dispatch] = useReducer(
    (s: TextBufferState, a: TextBufferAction) =>
      textBufferReducer(s, a, { inputFilter, singleLine }),
    initialState,
  );
  const {
    lines,
    cursorRow,
    cursorCol,
    preferredCol,
    selectionAnchor,
    visualLayout,
    transformationsByLine,
    pastedContent,
    expandedPaste,
  } = state;

  const text = useMemo(() => lines.join('\n'), [lines]);

  const visualCursor = useMemo(
    () => calculateVisualCursorFromLayout(visualLayout, [cursorRow, cursorCol]),
    [visualLayout, cursorRow, cursorCol],
  );

  const {
    visualLines,
    visualToLogicalMap,
    transformedToLogicalMaps,
    visualToTransformedMap,
  } = visualLayout;

  const [scrollRowState, setScrollRowState] = useState<number>(0);

  useEffect(() => {
    if (onChange) {
      onChange(text);
    }
  }, [text, onChange]);

  useEffect(() => {
    dispatch({
      type: 'set_viewport',
      payload: { width: viewport.width, height: viewport.height },
    });
  }, [viewport.width, viewport.height]);

  // Update visual scroll (vertical)
  useEffect(() => {
    const { height } = viewport;
    const totalVisualLines = visualLines.length;
    const maxScrollStart = Math.max(0, totalVisualLines - height);
    let newVisualScrollRow = scrollRowState;

    if (visualCursor[0] < scrollRowState) {
      newVisualScrollRow = visualCursor[0];
    } else if (visualCursor[0] >= scrollRowState + height) {
      newVisualScrollRow = visualCursor[0] - height + 1;
    }

    // When the number of visual lines shrinks (e.g., after widening the viewport),
    // ensure scroll never starts beyond the last valid start so we can render a full window.
    newVisualScrollRow = clamp(newVisualScrollRow, 0, maxScrollStart);

    if (newVisualScrollRow !== scrollRowState) {
      setScrollRowState(newVisualScrollRow);
    }
  }, [visualCursor, scrollRowState, viewport, visualLines.length]);

  const insert = useCallback(
    (ch: string, { paste = false }: { paste?: boolean } = {}): void => {
      if (typeof ch !== 'string') {
        return;
      }

      let textToInsert = ch;
      const minLengthToInferAsDragDrop = 3;
      if (
        ch.length >= minLengthToInferAsDragDrop &&
        !shellModeActive &&
        paste
      ) {
        let potentialPath = ch.trim();
        const quoteMatch = potentialPath.match(/^'(.*)'$/);
        if (quoteMatch) {
          potentialPath = quoteMatch[1];
        }

        potentialPath = potentialPath.trim();

        const processed = parsePastedPaths(potentialPath, isValidPath);
        if (processed) {
          textToInsert = processed;
        }
      }

      let currentText = '';
      for (const char of toCodePoints(textToInsert)) {
        if (char.codePointAt(0) === 127) {
          if (currentText.length > 0) {
            dispatch({ type: 'insert', payload: currentText, isPaste: paste });
            currentText = '';
          }
          dispatch({ type: 'backspace' });
        } else {
          currentText += char;
        }
      }
      if (currentText.length > 0) {
        dispatch({ type: 'insert', payload: currentText, isPaste: paste });
      }
    },
    [isValidPath, shellModeActive],
  );

  const newline = useCallback((): void => {
    if (singleLine) {
      return;
    }
    dispatch({ type: 'insert', payload: '\n' });
  }, [singleLine]);

  const backspace = useCallback((): void => {
    dispatch({ type: 'backspace' });
  }, []);

  const del = useCallback((): void => {
    dispatch({ type: 'delete' });
  }, []);

  const move = useCallback(
    (dir: Direction): void => {
      dispatch({ type: 'move', payload: { dir } });
    },
    [dispatch],
  );

  const undo = useCallback((): void => {
    dispatch({ type: 'undo' });
  }, []);

  const redo = useCallback((): void => {
    dispatch({ type: 'redo' });
  }, []);

  const setText = useCallback((newText: string): void => {
    dispatch({ type: 'set_text', payload: newText });
  }, []);

  const deleteWordLeft = useCallback((): void => {
    dispatch({ type: 'delete_word_left' });
  }, []);

  const deleteWordRight = useCallback((): void => {
    dispatch({ type: 'delete_word_right' });
  }, []);

  const killLineRight = useCallback((): void => {
    dispatch({ type: 'kill_line_right' });
  }, []);

  const killLineLeft = useCallback((): void => {
    dispatch({ type: 'kill_line_left' });
  }, []);

  // Vim-specific operations
  const vimDeleteWordForward = useCallback((count: number): void => {
    dispatch({ type: 'vim_delete_word_forward', payload: { count } });
  }, []);

  const vimDeleteWordBackward = useCallback((count: number): void => {
    dispatch({ type: 'vim_delete_word_backward', payload: { count } });
  }, []);

  const vimDeleteWordEnd = useCallback((count: number): void => {
    dispatch({ type: 'vim_delete_word_end', payload: { count } });
  }, []);

  const vimChangeWordForward = useCallback((count: number): void => {
    dispatch({ type: 'vim_change_word_forward', payload: { count } });
  }, []);

  const vimChangeWordBackward = useCallback((count: number): void => {
    dispatch({ type: 'vim_change_word_backward', payload: { count } });
  }, []);

  const vimChangeWordEnd = useCallback((count: number): void => {
    dispatch({ type: 'vim_change_word_end', payload: { count } });
  }, []);

  const vimDeleteLine = useCallback((count: number): void => {
    dispatch({ type: 'vim_delete_line', payload: { count } });
  }, []);

  const vimChangeLine = useCallback((count: number): void => {
    dispatch({ type: 'vim_change_line', payload: { count } });
  }, []);

  const vimDeleteToEndOfLine = useCallback((): void => {
    dispatch({ type: 'vim_delete_to_end_of_line' });
  }, []);

  const vimChangeToEndOfLine = useCallback((): void => {
    dispatch({ type: 'vim_change_to_end_of_line' });
  }, []);

  const vimChangeMovement = useCallback(
    (movement: 'h' | 'j' | 'k' | 'l', count: number): void => {
      dispatch({ type: 'vim_change_movement', payload: { movement, count } });
    },
    [],
  );

  // New vim navigation and operation methods
  const vimMoveLeft = useCallback((count: number): void => {
    dispatch({ type: 'vim_move_left', payload: { count } });
  }, []);

  const vimMoveRight = useCallback((count: number): void => {
    dispatch({ type: 'vim_move_right', payload: { count } });
  }, []);

  const vimMoveUp = useCallback((count: number): void => {
    dispatch({ type: 'vim_move_up', payload: { count } });
  }, []);

  const vimMoveDown = useCallback((count: number): void => {
    dispatch({ type: 'vim_move_down', payload: { count } });
  }, []);

  const vimMoveWordForward = useCallback((count: number): void => {
    dispatch({ type: 'vim_move_word_forward', payload: { count } });
  }, []);

  const vimMoveWordBackward = useCallback((count: number): void => {
    dispatch({ type: 'vim_move_word_backward', payload: { count } });
  }, []);

  const vimMoveWordEnd = useCallback((count: number): void => {
    dispatch({ type: 'vim_move_word_end', payload: { count } });
  }, []);

  const vimDeleteChar = useCallback((count: number): void => {
    dispatch({ type: 'vim_delete_char', payload: { count } });
  }, []);

  const vimInsertAtCursor = useCallback((): void => {
    dispatch({ type: 'vim_insert_at_cursor' });
  }, []);

  const vimAppendAtCursor = useCallback((): void => {
    dispatch({ type: 'vim_append_at_cursor' });
  }, []);

  const vimOpenLineBelow = useCallback((): void => {
    dispatch({ type: 'vim_open_line_below' });
  }, []);

  const vimOpenLineAbove = useCallback((): void => {
    dispatch({ type: 'vim_open_line_above' });
  }, []);

  const vimAppendAtLineEnd = useCallback((): void => {
    dispatch({ type: 'vim_append_at_line_end' });
  }, []);

  const vimInsertAtLineStart = useCallback((): void => {
    dispatch({ type: 'vim_insert_at_line_start' });
  }, []);

  const vimMoveToLineStart = useCallback((): void => {
    dispatch({ type: 'vim_move_to_line_start' });
  }, []);

  const vimMoveToLineEnd = useCallback((): void => {
    dispatch({ type: 'vim_move_to_line_end' });
  }, []);

  const vimMoveToFirstNonWhitespace = useCallback((): void => {
    dispatch({ type: 'vim_move_to_first_nonwhitespace' });
  }, []);

  const vimMoveToFirstLine = useCallback((): void => {
    dispatch({ type: 'vim_move_to_first_line' });
  }, []);

  const vimMoveToLastLine = useCallback((): void => {
    dispatch({ type: 'vim_move_to_last_line' });
  }, []);

  const vimMoveToLine = useCallback((lineNumber: number): void => {
    dispatch({ type: 'vim_move_to_line', payload: { lineNumber } });
  }, []);

  const vimEscapeInsertMode = useCallback((): void => {
    dispatch({ type: 'vim_escape_insert_mode' });
  }, []);

  const openInExternalEditor = useCallback(async (): Promise<void> => {
    const tmpDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'dsh-console-edit-'));
    const filePath = pathMod.join(tmpDir, 'buffer.txt');
    // Expand paste placeholders so user sees full content in editor
    const expandedText = text.replace(
      PASTED_TEXT_PLACEHOLDER_REGEX,
      (match) => pastedContent[match] || match,
    );
    fs.writeFileSync(filePath, expandedText, 'utf8');

    let command: string | undefined = undefined;
    const args = [filePath];

    const preferredEditorType = getPreferredEditor?.();
    if (!command && preferredEditorType) {
      command = getEditorCommand(preferredEditorType);
      if (isGuiEditor(preferredEditorType)) {
        args.unshift('--wait');
      }
    }

    if (!command) {
      command =
        process.env['VISUAL'] ??
        process.env['EDITOR'] ??
        (process.platform === 'win32' ? 'notepad' : 'vi');
    }

    dispatch({ type: 'create_undo_snapshot' });

    const wasRaw = stdin?.isRaw ?? false;
    try {
      setRawMode?.(false);
      const { status, error } = spawnSync(command, args, {
        stdio: 'inherit',
      });
      if (error) throw error;
      if (typeof status === 'number' && status !== 0)
        throw new Error(`External editor exited with status ${status}`);

      let newText = fs.readFileSync(filePath, 'utf8');
      newText = newText.replace(/\r\n?/g, '\n');

      // Attempt to re-collapse unchanged pasted content back into placeholders
      const sortedPlaceholders = Object.entries(pastedContent).sort(
        (a, b) => b[1].length - a[1].length,
      );
      for (const [id, content] of sortedPlaceholders) {
        if (newText.includes(content)) {
          newText = newText.replace(content, id);
        }
      }

      dispatch({ type: 'set_text', payload: newText, pushToUndo: false });
    } catch (err) {
      coreEvents.emitFeedback(
        'error',
        '[useTextBuffer] external editor error',
        err,
      );
    } finally {
      coreEvents.emit(CoreEvent.ExternalEditorClosed);
      if (wasRaw) setRawMode?.(true);
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
      try {
        fs.rmdirSync(tmpDir);
      } catch {
        /* ignore */
      }
    }
  }, [text, pastedContent, stdin, setRawMode, getPreferredEditor]);

  const handleInput = useCallback(
    (key: Key): boolean => {
      const { sequence: input } = key;

      if (key.name === 'paste') {
        insert(input, { paste: true });
        return true;
      }
      if (keyMatchers[Command.RETURN](key)) {
        if (singleLine) {
          return false;
        }
        newline();
        return true;
      }
      if (keyMatchers[Command.NEWLINE](key)) {
        if (singleLine) {
          return false;
        }
        newline();
        return true;
      }
      if (keyMatchers[Command.MOVE_LEFT](key)) {
        if (cursorRow === 0 && cursorCol === 0) return false;
        move('left');
        return true;
      }
      if (keyMatchers[Command.MOVE_RIGHT](key)) {
        const lastLineIdx = lines.length - 1;
        if (
          cursorRow === lastLineIdx &&
          cursorCol === cpLen(lines[lastLineIdx] ?? '')
        ) {
          return false;
        }
        move('right');
        return true;
      }
      if (keyMatchers[Command.MOVE_UP](key)) {
        if (cursorRow === 0) return false;
        move('up');
        return true;
      }
      if (keyMatchers[Command.MOVE_DOWN](key)) {
        if (cursorRow === lines.length - 1) return false;
        move('down');
        return true;
      }
      if (keyMatchers[Command.MOVE_WORD_LEFT](key)) {
        move('wordLeft');
        return true;
      }
      if (keyMatchers[Command.MOVE_WORD_RIGHT](key)) {
        move('wordRight');
        return true;
      }
      if (keyMatchers[Command.HOME](key)) {
        move('home');
        return true;
      }
      if (keyMatchers[Command.END](key)) {
        move('end');
        return true;
      }
      if (keyMatchers[Command.DELETE_WORD_BACKWARD](key)) {
        deleteWordLeft();
        return true;
      }
      if (keyMatchers[Command.DELETE_WORD_FORWARD](key)) {
        deleteWordRight();
        return true;
      }
      if (keyMatchers[Command.DELETE_CHAR_LEFT](key)) {
        backspace();
        return true;
      }
      if (keyMatchers[Command.DELETE_CHAR_RIGHT](key)) {
        del();
        return true;
      }
      if (keyMatchers[Command.UNDO](key)) {
        undo();
        return true;
      }
      if (keyMatchers[Command.REDO](key)) {
        redo();
        return true;
      }
      if (key.insertable) {
        insert(input, { paste: false });
        return true;
      }
      return false;
    },
    [
      newline,
      move,
      deleteWordLeft,
      deleteWordRight,
      backspace,
      del,
      insert,
      undo,
      redo,
      cursorRow,
      cursorCol,
      lines,
      singleLine,
    ],
  );

  const visualScrollRow = useMemo(() => {
    const totalVisualLines = visualLines.length;
    return Math.min(
      scrollRowState,
      Math.max(0, totalVisualLines - viewport.height),
    );
  }, [visualLines.length, scrollRowState, viewport.height]);

  const renderedVisualLines = useMemo(
    () => visualLines.slice(visualScrollRow, visualScrollRow + viewport.height),
    [visualLines, visualScrollRow, viewport.height],
  );

  const replaceRange = useCallback(
    (
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      text: string,
    ): void => {
      dispatch({
        type: 'replace_range',
        payload: { startRow, startCol, endRow, endCol, text },
      });
    },
    [],
  );

  const replaceRangeByOffset = useCallback(
    (startOffset: number, endOffset: number, replacementText: string): void => {
      const [startRow, startCol] = offsetToLogicalPos(text, startOffset);
      const [endRow, endCol] = offsetToLogicalPos(text, endOffset);
      replaceRange(startRow, startCol, endRow, endCol, replacementText);
    },
    [text, replaceRange],
  );

  const moveToOffset = useCallback((offset: number): void => {
    dispatch({ type: 'move_to_offset', payload: { offset } });
  }, []);

  const moveToVisualPosition = useCallback(
    (visRow: number, visCol: number): void => {
      const {
        visualLines,
        visualToLogicalMap,
        transformedToLogicalMaps,
        visualToTransformedMap,
      } = visualLayout;
      // Clamp visRow to valid range
      const clampedVisRow = Math.max(
        0,
        Math.min(visRow, visualLines.length - 1),
      );
      const visualLine = visualLines[clampedVisRow] || '';

      if (visualToLogicalMap[clampedVisRow]) {
        const [logRow] = visualToLogicalMap[clampedVisRow];
        const transformedToLogicalMap =
          transformedToLogicalMaps?.[logRow] ?? [];

        // Where does this visual line begin within the transformed line?
        const startColInTransformed =
          visualToTransformedMap?.[clampedVisRow] ?? 0;

        // Handle wide characters: convert visual X position to character offset
        const codePoints = toCodePoints(visualLine);
        let currentVisX = 0;
        let charOffset = 0;

        for (const char of codePoints) {
          const charWidth = getCachedStringWidth(char);
          // If the click is within this character
          if (visCol < currentVisX + charWidth) {
            // Check if we clicked the second half of a wide character
            if (charWidth > 1 && visCol >= currentVisX + charWidth / 2) {
              charOffset++;
            }
            break;
          }
          currentVisX += charWidth;
          charOffset++;
        }

        // Clamp charOffset to length
        charOffset = Math.min(charOffset, codePoints.length);

        // Map character offset through transformations to get logical position
        const transformedCol = Math.min(
          startColInTransformed + charOffset,
          Math.max(0, transformedToLogicalMap.length - 1),
        );

        const newCursorRow = logRow;
        const newCursorCol =
          transformedToLogicalMap[transformedCol] ?? cpLen(lines[logRow] ?? '');

        dispatch({
          type: 'set_cursor',
          payload: {
            cursorRow: newCursorRow,
            cursorCol: newCursorCol,
            preferredCol: charOffset,
          },
        });
      }
    },
    [visualLayout, lines],
  );

  const getLogicalPositionFromVisual = useCallback(
    (visRow: number, visCol: number): { row: number; col: number } | null => {
      const {
        visualLines,
        visualToLogicalMap,
        transformedToLogicalMaps,
        visualToTransformedMap,
      } = visualLayout;

      // Clamp visRow to valid range
      const clampedVisRow = Math.max(
        0,
        Math.min(visRow, visualLines.length - 1),
      );
      const visualLine = visualLines[clampedVisRow] || '';

      if (!visualToLogicalMap[clampedVisRow]) {
        return null;
      }

      const [logRow] = visualToLogicalMap[clampedVisRow];
      const transformedToLogicalMap = transformedToLogicalMaps?.[logRow] ?? [];

      // Where does this visual line begin within the transformed line?
      const startColInTransformed =
        visualToTransformedMap?.[clampedVisRow] ?? 0;

      // Handle wide characters: convert visual X position to character offset
      const codePoints = toCodePoints(visualLine);
      let currentVisX = 0;
      let charOffset = 0;

      for (const char of codePoints) {
        const charWidth = getCachedStringWidth(char);
        if (visCol < currentVisX + charWidth) {
          if (charWidth > 1 && visCol >= currentVisX + charWidth / 2) {
            charOffset++;
          }
          break;
        }
        currentVisX += charWidth;
        charOffset++;
      }

      charOffset = Math.min(charOffset, codePoints.length);

      const transformedCol = Math.min(
        startColInTransformed + charOffset,
        Math.max(0, transformedToLogicalMap.length - 1),
      );

      const row = logRow;
      const col =
        transformedToLogicalMap[transformedCol] ?? cpLen(lines[logRow] ?? '');

      return { row, col };
    },
    [visualLayout, lines],
  );

  const getOffset = useCallback(
    (): number => logicalPosToOffset(lines, cursorRow, cursorCol),
    [lines, cursorRow, cursorCol],
  );

  const togglePasteExpansion = useCallback(
    (id: string, row: number, col: number): void => {
      dispatch({ type: 'toggle_paste_expansion', payload: { id, row, col } });
    },
    [],
  );

  const getExpandedPasteAtLineCallback = useCallback(
    (lineIndex: number): string | null =>
      getExpandedPasteAtLine(lineIndex, expandedPaste),
    [expandedPaste],
  );

  const returnValue: TextBuffer = useMemo(
    () => ({
      lines,
      text,
      cursor: [cursorRow, cursorCol],
      preferredCol,
      selectionAnchor,
      pastedContent,

      allVisualLines: visualLines,
      viewportVisualLines: renderedVisualLines,
      visualCursor,
      visualScrollRow,
      visualToLogicalMap,
      transformedToLogicalMaps,
      visualToTransformedMap,
      transformationsByLine,
      visualLayout,
      setText,
      insert,
      newline,
      backspace,
      del,
      move,
      undo,
      redo,
      replaceRange,
      replaceRangeByOffset,
      moveToOffset,
      getOffset,
      moveToVisualPosition,
      getLogicalPositionFromVisual,
      getExpandedPasteAtLine: getExpandedPasteAtLineCallback,
      togglePasteExpansion,
      expandedPaste,
      deleteWordLeft,
      deleteWordRight,

      killLineRight,
      killLineLeft,
      handleInput,
      openInExternalEditor,
      // Vim-specific operations
      vimDeleteWordForward,
      vimDeleteWordBackward,
      vimDeleteWordEnd,
      vimChangeWordForward,
      vimChangeWordBackward,
      vimChangeWordEnd,
      vimDeleteLine,
      vimChangeLine,
      vimDeleteToEndOfLine,
      vimChangeToEndOfLine,
      vimChangeMovement,
      vimMoveLeft,
      vimMoveRight,
      vimMoveUp,
      vimMoveDown,
      vimMoveWordForward,
      vimMoveWordBackward,
      vimMoveWordEnd,
      vimDeleteChar,
      vimInsertAtCursor,
      vimAppendAtCursor,
      vimOpenLineBelow,
      vimOpenLineAbove,
      vimAppendAtLineEnd,
      vimInsertAtLineStart,
      vimMoveToLineStart,
      vimMoveToLineEnd,
      vimMoveToFirstNonWhitespace,
      vimMoveToFirstLine,
      vimMoveToLastLine,
      vimMoveToLine,
      vimEscapeInsertMode,
    }),
    [
      lines,
      text,
      cursorRow,
      cursorCol,
      preferredCol,
      selectionAnchor,
      pastedContent,
      visualLines,
      renderedVisualLines,
      visualCursor,
      visualScrollRow,
      visualToLogicalMap,
      transformedToLogicalMaps,
      visualToTransformedMap,
      transformationsByLine,
      visualLayout,
      setText,
      insert,
      newline,
      backspace,
      del,
      move,
      undo,
      redo,
      replaceRange,
      replaceRangeByOffset,
      moveToOffset,
      getOffset,
      moveToVisualPosition,
      getLogicalPositionFromVisual,
      getExpandedPasteAtLineCallback,
      togglePasteExpansion,
      expandedPaste,
      deleteWordLeft,
      deleteWordRight,
      killLineRight,
      killLineLeft,
      handleInput,
      openInExternalEditor,
      vimDeleteWordForward,
      vimDeleteWordBackward,
      vimDeleteWordEnd,
      vimChangeWordForward,
      vimChangeWordBackward,
      vimChangeWordEnd,
      vimDeleteLine,
      vimChangeLine,
      vimDeleteToEndOfLine,
      vimChangeToEndOfLine,
      vimChangeMovement,
      vimMoveLeft,
      vimMoveRight,
      vimMoveUp,
      vimMoveDown,
      vimMoveWordForward,
      vimMoveWordBackward,
      vimMoveWordEnd,
      vimDeleteChar,
      vimInsertAtCursor,
      vimAppendAtCursor,
      vimOpenLineBelow,
      vimOpenLineAbove,
      vimAppendAtLineEnd,
      vimInsertAtLineStart,
      vimMoveToLineStart,
      vimMoveToLineEnd,
      vimMoveToFirstNonWhitespace,
      vimMoveToFirstLine,
      vimMoveToLastLine,
      vimMoveToLine,
      vimEscapeInsertMode,
    ],
  );
  return returnValue;
}

export interface TextBuffer {
  // State
  lines: string[]; // Logical lines
  text: string;
  cursor: [number, number]; // Logical cursor [row, col]
  /**
   * When the user moves the caret vertically we try to keep their original
   * horizontal column even when passing through shorter lines.  We remember
   * that *preferred* column in this field while the user is still travelling
   * vertically.  Any explicit horizontal movement resets the preference.
   */
  preferredCol: number | null; // Preferred visual column
  selectionAnchor: [number, number] | null; // Logical selection anchor
  pastedContent: Record<string, string>;

  // Visual state (handles wrapping)
  allVisualLines: string[]; // All visual lines for the current text and viewport width.
  viewportVisualLines: string[]; // The subset of visual lines to be rendered based on visualScrollRow and viewport.height
  visualCursor: [number, number]; // Visual cursor [row, col] relative to the start of all visualLines
  visualScrollRow: number; // Scroll position for visual lines (index of the first visible visual line)
  /**
   * For each visual line (by absolute index in allVisualLines) provides a tuple
   * [logicalLineIndex, startColInLogical] that maps where that visual line
   * begins within the logical buffer. Indices are code-point based.
   */
  visualToLogicalMap: Array<[number, number]>;
  /**
   * For each logical line, an array mapping transformed positions (in the transformed
   * line) back to logical column indices.
   */
  transformedToLogicalMaps: number[][];
  /**
   * For each visual line (absolute index across all visual lines), the start index
   * within that logical line's transformed content.
   */
  visualToTransformedMap: number[];
  /** Cached transformations per logical line */
  transformationsByLine: Transformation[][];
  visualLayout: VisualLayout;

  // Actions

  /**
   * Replaces the entire buffer content with the provided text.
   * The operation is undoable.
   */
  setText: (text: string) => void;
  /**
   * Insert a single character or string without newlines.
   */
  insert: (ch: string, opts?: { paste?: boolean }) => void;
  newline: () => void;
  backspace: () => void;
  del: () => void;
  move: (dir: Direction) => void;
  undo: () => void;
  redo: () => void;
  /**
   * Replaces the text within the specified range with new text.
   * Handles both single-line and multi-line ranges.
   *
   * @param startRow The starting row index (inclusive).
   * @param startCol The starting column index (inclusive, code-point based).
   * @param endRow The ending row index (inclusive).
   * @param endCol The ending column index (exclusive, code-point based).
   * @param text The new text to insert.
   * @returns True if the buffer was modified, false otherwise.
   */
  replaceRange: (
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    text: string,
  ) => void;
  /**
   * Delete the word to the *left* of the caret, mirroring common
   * Ctrl/Alt+Backspace behaviour in editors & terminals. Both the adjacent
   * whitespace *and* the word characters immediately preceding the caret are
   * removed.  If the caret is already at column‑0 this becomes a no-op.
   */
  deleteWordLeft: () => void;
  /**
   * Delete the word to the *right* of the caret, akin to many editors'
   * Ctrl/Alt+Delete shortcut.  Removes any whitespace/punctuation that
   * follows the caret and the next contiguous run of word characters.
   */
  deleteWordRight: () => void;

  /**
   * Deletes text from the cursor to the end of the current line.
   */
  killLineRight: () => void;
  /**
   * Deletes text from the start of the current line to the cursor.
   */
  killLineLeft: () => void;
  /**
   * High level "handleInput" – receives what Ink gives us.
   */
  handleInput: (key: Key) => void;
  /**
   * Opens the current buffer contents in the user's preferred terminal text
   * editor ($VISUAL or $EDITOR, falling back to "vi").  The method blocks
   * until the editor exits, then reloads the file and replaces the in‑memory
   * buffer with whatever the user saved.
   *
   * The operation is treated as a single undoable edit – we snapshot the
   * previous state *once* before launching the editor so one `undo()` will
   * revert the entire change set.
   *
   * Note: We purposefully rely on the *synchronous* spawn API so that the
   * calling process genuinely waits for the editor to close before
   * continuing.  This mirrors Git's behaviour and simplifies downstream
   * control‑flow (callers can simply `await` the Promise).
   */
  openInExternalEditor: () => Promise<void>;

  replaceRangeByOffset: (
    startOffset: number,
    endOffset: number,
    replacementText: string,
  ) => void;
  getOffset: () => number;
  moveToOffset(offset: number): void;
  moveToVisualPosition(visualRow: number, visualCol: number): void;
  /**
   * Convert visual coordinates to logical position without moving cursor.
   * Returns null if the position is out of bounds.
   */
  getLogicalPositionFromVisual(
    visualRow: number,
    visualCol: number,
  ): { row: number; col: number } | null;
  /**
   * Check if a line index falls within an expanded paste region.
   * Returns the paste placeholder ID if found, null otherwise.
   */
  getExpandedPasteAtLine(lineIndex: number): string | null;
  /**
   * Toggle expansion state for a paste placeholder.
   * If collapsed, expands to show full content inline.
   * If expanded, collapses back to placeholder.
   */
  togglePasteExpansion(id: string, row: number, col: number): void;
  /**
   * The current expanded paste info (read-only).
   */
  expandedPaste: ExpandedPasteInfo | null;

  // Vim-specific operations
  /**
   * Delete N words forward from cursor position (vim 'dw' command)
   */
  vimDeleteWordForward: (count: number) => void;
  /**
   * Delete N words backward from cursor position (vim 'db' command)
   */
  vimDeleteWordBackward: (count: number) => void;
  /**
   * Delete to end of N words from cursor position (vim 'de' command)
   */
  vimDeleteWordEnd: (count: number) => void;
  /**
   * Change N words forward from cursor position (vim 'cw' command)
   */
  vimChangeWordForward: (count: number) => void;
  /**
   * Change N words backward from cursor position (vim 'cb' command)
   */
  vimChangeWordBackward: (count: number) => void;
  /**
   * Change to end of N words from cursor position (vim 'ce' command)
   */
  vimChangeWordEnd: (count: number) => void;
  /**
   * Delete N lines from cursor position (vim 'dd' command)
   */
  vimDeleteLine: (count: number) => void;
  /**
   * Change N lines from cursor position (vim 'cc' command)
   */
  vimChangeLine: (count: number) => void;
  /**
   * Delete from cursor to end of line (vim 'D' command)
   */
  vimDeleteToEndOfLine: () => void;
  /**
   * Change from cursor to end of line (vim 'C' command)
   */
  vimChangeToEndOfLine: () => void;
  /**
   * Change movement operations (vim 'ch', 'cj', 'ck', 'cl' commands)
   */
  vimChangeMovement: (movement: 'h' | 'j' | 'k' | 'l', count: number) => void;
  /**
   * Move cursor left N times (vim 'h' command)
   */
  vimMoveLeft: (count: number) => void;
  /**
   * Move cursor right N times (vim 'l' command)
   */
  vimMoveRight: (count: number) => void;
  /**
   * Move cursor up N times (vim 'k' command)
   */
  vimMoveUp: (count: number) => void;
  /**
   * Move cursor down N times (vim 'j' command)
   */
  vimMoveDown: (count: number) => void;
  /**
   * Move cursor forward N words (vim 'w' command)
   */
  vimMoveWordForward: (count: number) => void;
  /**
   * Move cursor backward N words (vim 'b' command)
   */
  vimMoveWordBackward: (count: number) => void;
  /**
   * Move cursor to end of Nth word (vim 'e' command)
   */
  vimMoveWordEnd: (count: number) => void;
  /**
   * Delete N characters at cursor (vim 'x' command)
   */
  vimDeleteChar: (count: number) => void;
  /**
   * Enter insert mode at cursor (vim 'i' command)
   */
  vimInsertAtCursor: () => void;
  /**
   * Enter insert mode after cursor (vim 'a' command)
   */
  vimAppendAtCursor: () => void;
  /**
   * Open new line below and enter insert mode (vim 'o' command)
   */
  vimOpenLineBelow: () => void;
  /**
   * Open new line above and enter insert mode (vim 'O' command)
   */
  vimOpenLineAbove: () => void;
  /**
   * Move to end of line and enter insert mode (vim 'A' command)
   */
  vimAppendAtLineEnd: () => void;
  /**
   * Move to first non-whitespace and enter insert mode (vim 'I' command)
   */
  vimInsertAtLineStart: () => void;
  /**
   * Move cursor to beginning of line (vim '0' command)
   */
  vimMoveToLineStart: () => void;
  /**
   * Move cursor to end of line (vim '$' command)
   */
  vimMoveToLineEnd: () => void;
  /**
   * Move cursor to first non-whitespace character (vim '^' command)
   */
  vimMoveToFirstNonWhitespace: () => void;
  /**
   * Move cursor to first line (vim 'gg' command)
   */
  vimMoveToFirstLine: () => void;
  /**
   * Move cursor to last line (vim 'G' command)
   */
  vimMoveToLastLine: () => void;
  /**
   * Move cursor to specific line number (vim '[N]G' command)
   */
  vimMoveToLine: (lineNumber: number) => void;
  /**
   * Handle escape from insert mode (moves cursor left if not at line start)
   */
  vimEscapeInsertMode: () => void;
}
