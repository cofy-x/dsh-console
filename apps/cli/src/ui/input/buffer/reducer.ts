/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  calculateVisualCursorFromLayout,
  clamp,
  findNextWordBoundary,
  findPrevWordStartInLine,
  findNextWordStartInLine,
  offsetToLogicalPos,
  calculateLayout,
  findPrevWordBoundary,
  getTransformUnderCursor,
  calculateTransformations,
  findAtomicPlaceholderForBackspace,
  calculateTransformationsForLine,
  findAtomicPlaceholderForDelete,
  shiftExpandedRegions,
  detachExpandedPaste,
} from './utils.js';
import {
  cpLen,
  cpSlice,
  stripUnsafeCharacters,
} from '../../../text/processing.js';
import { handleVimAction, type VimAction } from './vim-actions.js';
import {
  LARGE_PASTE_CHAR_THRESHOLD,
  LARGE_PASTE_LINE_THRESHOLD,
  type TextBufferAction,
  type TextBufferOptions,
  type TextBufferState,
  type UndoHistoryEntry,
} from './types.js';
import { debugLogger } from '@cofy-x/dsh-console-core';

export const replaceRangeInternal = (
  state: TextBufferState,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  text: string,
): TextBufferState => {
  const currentLine = (row: number) => state.lines[row] || '';
  const currentLineLen = (row: number) => cpLen(currentLine(row));
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  if (
    startRow > endRow ||
    (startRow === endRow && startCol > endCol) ||
    startRow < 0 ||
    startCol < 0 ||
    endRow >= state.lines.length ||
    (endRow < state.lines.length && endCol > currentLineLen(endRow))
  ) {
    return state; // Invalid range
  }

  const newLines = [...state.lines];

  const sCol = clamp(startCol, 0, currentLineLen(startRow));
  const eCol = clamp(endCol, 0, currentLineLen(endRow));

  const prefix = cpSlice(currentLine(startRow), 0, sCol);
  const suffix = cpSlice(currentLine(endRow), eCol);

  const normalisedReplacement = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const replacementParts = normalisedReplacement.split('\n');

  // The combined first line of the new text
  const firstLine = prefix + replacementParts[0];

  if (replacementParts.length === 1) {
    // No newlines in replacement: combine prefix, replacement, and suffix on one line.
    newLines.splice(startRow, endRow - startRow + 1, firstLine + suffix);
  } else {
    // Newlines in replacement: create new lines.
    const lastLine = replacementParts[replacementParts.length - 1] + suffix;
    const middleLines = replacementParts.slice(1, -1);
    newLines.splice(
      startRow,
      endRow - startRow + 1,
      firstLine,
      ...middleLines,
      lastLine,
    );
  }

  const finalCursorRow = startRow + replacementParts.length - 1;
  const finalCursorCol =
    (replacementParts.length > 1 ? 0 : sCol) +
    cpLen(replacementParts[replacementParts.length - 1]);

  return {
    ...state,
    lines: newLines,
    cursorRow: Math.min(Math.max(finalCursorRow, 0), newLines.length - 1),
    cursorCol: Math.max(
      0,
      Math.min(finalCursorCol, cpLen(newLines[finalCursorRow] || '')),
    ),
    preferredCol: null,
  };
};

const historyLimit = 100;

export const pushUndo = (currentState: TextBufferState): TextBufferState => {
  const snapshot: UndoHistoryEntry = {
    lines: [...currentState.lines],
    cursorRow: currentState.cursorRow,
    cursorCol: currentState.cursorCol,
    pastedContent: { ...currentState.pastedContent },
    expandedPaste: currentState.expandedPaste
      ? { ...currentState.expandedPaste }
      : null,
  };
  const newStack = [...currentState.undoStack, snapshot];
  if (newStack.length > historyLimit) {
    newStack.shift();
  }
  return { ...currentState, undoStack: newStack, redoStack: [] };
};

function generatePastedTextId(
  content: string,
  lineCount: number,
  pastedContent: Record<string, string>,
): string {
  const base =
    lineCount > LARGE_PASTE_LINE_THRESHOLD
      ? `[Pasted Text: ${lineCount} lines]`
      : `[Pasted Text: ${content.length} chars]`;

  let id = base;
  let suffix = 2;
  while (pastedContent[id]) {
    id = base.replace(']', ` #${suffix}]`);
    suffix++;
  }
  return id;
}

function textBufferReducerLogic(
  state: TextBufferState,
  action: TextBufferAction,
  options: TextBufferOptions = {},
): TextBufferState {
  const pushUndoLocal = pushUndo;

  const currentLine = (r: number): string => state.lines[r] ?? '';
  const currentLineLen = (r: number): number => cpLen(currentLine(r));

  switch (action.type) {
    case 'set_text': {
      let nextState = state;
      if (action.pushToUndo !== false) {
        nextState = pushUndoLocal(state);
      }
      const newContentLines = action.payload
        .replace(/\r\n?/g, '\n')
        .split('\n');
      const lines = newContentLines.length === 0 ? [''] : newContentLines;
      const lastNewLineIndex = lines.length - 1;
      return {
        ...nextState,
        lines,
        cursorRow: lastNewLineIndex,
        cursorCol: cpLen(lines[lastNewLineIndex] ?? ''),
        preferredCol: null,
        pastedContent: action.payload === '' ? {} : nextState.pastedContent,
      };
    }

    case 'insert': {
      const nextState = detachExpandedPaste(pushUndoLocal(state));
      const newLines = [...nextState.lines];
      let newCursorRow = nextState.cursorRow;
      let newCursorCol = nextState.cursorCol;

      const currentLine = (r: number) => newLines[r] ?? '';

      let payload = action.payload;
      let newPastedContent = nextState.pastedContent;

      if (action.isPaste) {
        // Normalize line endings for pastes
        payload = payload.replace(/\r\n|\r/g, '\n');
        const lineCount = payload.split('\n').length;
        if (
          lineCount > LARGE_PASTE_LINE_THRESHOLD ||
          payload.length > LARGE_PASTE_CHAR_THRESHOLD
        ) {
          const id = generatePastedTextId(payload, lineCount, newPastedContent);
          newPastedContent = {
            ...newPastedContent,
            [id]: payload,
          };
          payload = id;
        }
      }

      if (options.singleLine) {
        payload = payload.replace(/[\r\n]/g, '');
      }
      if (options.inputFilter) {
        payload = options.inputFilter(payload);
      }

      if (payload.length === 0) {
        return state;
      }

      const str = stripUnsafeCharacters(
        payload.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
      );
      const parts = str.split('\n');
      const lineContent = currentLine(newCursorRow);
      const before = cpSlice(lineContent, 0, newCursorCol);
      const after = cpSlice(lineContent, newCursorCol);

      let lineDelta = 0;
      if (parts.length > 1) {
        newLines[newCursorRow] = before + parts[0];
        const remainingParts = parts.slice(1);
        const lastPartOriginal = remainingParts.pop() ?? '';
        newLines.splice(newCursorRow + 1, 0, ...remainingParts);
        newLines.splice(
          newCursorRow + parts.length - 1,
          0,
          lastPartOriginal + after,
        );
        lineDelta = parts.length - 1;
        newCursorRow = newCursorRow + parts.length - 1;
        newCursorCol = cpLen(lastPartOriginal);
      } else {
        newLines[newCursorRow] = before + parts[0] + after;
        newCursorCol = cpLen(before) + cpLen(parts[0]);
      }

      const { newInfo: newExpandedPaste, isDetached } = shiftExpandedRegions(
        nextState.expandedPaste,
        nextState.cursorRow,
        lineDelta,
      );

      if (isDetached && newExpandedPaste === null && nextState.expandedPaste) {
        delete newPastedContent[nextState.expandedPaste.id];
      }

      return {
        ...nextState,
        lines: newLines,
        cursorRow: newCursorRow,
        cursorCol: newCursorCol,
        preferredCol: null,
        pastedContent: newPastedContent,
        expandedPaste: newExpandedPaste,
      };
    }

    case 'add_pasted_content': {
      const { id, text } = action.payload;
      return {
        ...state,
        pastedContent: {
          ...state.pastedContent,
          [id]: text,
        },
      };
    }

    case 'backspace': {
      const stateWithUndo = pushUndoLocal(state);
      const currentState = detachExpandedPaste(stateWithUndo);
      const { cursorRow, cursorCol, lines, transformationsByLine } =
        currentState;

      // Early return if at start of buffer
      if (cursorCol === 0 && cursorRow === 0) return currentState;

      // Check if cursor is at end of an atomic placeholder
      const transformations = transformationsByLine[cursorRow] ?? [];
      const placeholder = findAtomicPlaceholderForBackspace(
        lines[cursorRow],
        cursorCol,
        transformations,
      );

      if (placeholder) {
        const nextState = currentState;
        const newLines = [...nextState.lines];
        newLines[cursorRow] =
          cpSlice(newLines[cursorRow], 0, placeholder.start) +
          cpSlice(newLines[cursorRow], placeholder.end);

        // Recalculate transformations for the modified line
        const newTransformations = [...nextState.transformationsByLine];
        newTransformations[cursorRow] = calculateTransformationsForLine(
          newLines[cursorRow],
        );

        // Clean up pastedContent if this was a paste placeholder
        let newPastedContent = nextState.pastedContent;
        if (placeholder.type === 'paste' && placeholder.id) {
          const { [placeholder.id]: _, ...remaining } = nextState.pastedContent;
          newPastedContent = remaining;
        }

        return {
          ...nextState,
          lines: newLines,
          cursorCol: placeholder.start,
          preferredCol: null,
          transformationsByLine: newTransformations,
          pastedContent: newPastedContent,
        };
      }

      // Standard backspace logic
      const nextState = currentState;
      const newLines = [...nextState.lines];
      let newCursorRow = nextState.cursorRow;
      let newCursorCol = nextState.cursorCol;

      const currentLine = (r: number) => newLines[r] ?? '';

      let lineDelta = 0;
      if (newCursorCol > 0) {
        const lineContent = currentLine(newCursorRow);
        newLines[newCursorRow] =
          cpSlice(lineContent, 0, newCursorCol - 1) +
          cpSlice(lineContent, newCursorCol);
        newCursorCol--;
      } else if (newCursorRow > 0) {
        const prevLineContent = currentLine(newCursorRow - 1);
        const currentLineContentVal = currentLine(newCursorRow);
        const newCol = cpLen(prevLineContent);
        newLines[newCursorRow - 1] = prevLineContent + currentLineContentVal;
        newLines.splice(newCursorRow, 1);
        lineDelta = -1;
        newCursorRow--;
        newCursorCol = newCol;
      }

      const { newInfo: newExpandedPaste, isDetached } = shiftExpandedRegions(
        nextState.expandedPaste,
        nextState.cursorRow + lineDelta, // shift based on the line that was removed
        lineDelta,
        nextState.cursorRow,
      );

      const newPastedContent = { ...nextState.pastedContent };
      if (isDetached && nextState.expandedPaste) {
        delete newPastedContent[nextState.expandedPaste.id];
      }

      return {
        ...nextState,
        lines: newLines,
        cursorRow: newCursorRow,
        cursorCol: newCursorCol,
        preferredCol: null,
        pastedContent: newPastedContent,
        expandedPaste: newExpandedPaste,
      };
    }

    case 'set_viewport': {
      const { width, height } = action.payload;
      if (width === state.viewportWidth && height === state.viewportHeight) {
        return state;
      }
      return {
        ...state,
        viewportWidth: width,
        viewportHeight: height,
      };
    }

    case 'move': {
      const { dir } = action.payload;
      const { cursorRow, cursorCol, lines, visualLayout, preferredCol } = state;

      // Visual movements
      if (
        dir === 'left' ||
        dir === 'right' ||
        dir === 'up' ||
        dir === 'down' ||
        dir === 'home' ||
        dir === 'end'
      ) {
        const visualCursor = calculateVisualCursorFromLayout(visualLayout, [
          cursorRow,
          cursorCol,
        ]);
        const { visualLines, visualToLogicalMap } = visualLayout;

        let newVisualRow = visualCursor[0];
        let newVisualCol = visualCursor[1];
        let newPreferredCol = preferredCol;

        const currentVisLineLen = cpLen(visualLines[newVisualRow] ?? '');

        switch (dir) {
          case 'left':
            newPreferredCol = null;
            if (newVisualCol > 0) {
              newVisualCol--;
            } else if (newVisualRow > 0) {
              newVisualRow--;
              newVisualCol = cpLen(visualLines[newVisualRow] ?? '');
            }
            break;
          case 'right':
            newPreferredCol = null;
            if (newVisualCol < currentVisLineLen) {
              newVisualCol++;
            } else if (newVisualRow < visualLines.length - 1) {
              newVisualRow++;
              newVisualCol = 0;
            }
            break;
          case 'up':
            if (newVisualRow > 0) {
              if (newPreferredCol === null) newPreferredCol = newVisualCol;
              newVisualRow--;
              newVisualCol = clamp(
                newPreferredCol,
                0,
                cpLen(visualLines[newVisualRow] ?? ''),
              );
            }
            break;
          case 'down':
            if (newVisualRow < visualLines.length - 1) {
              if (newPreferredCol === null) newPreferredCol = newVisualCol;
              newVisualRow++;
              newVisualCol = clamp(
                newPreferredCol,
                0,
                cpLen(visualLines[newVisualRow] ?? ''),
              );
            }
            break;
          case 'home':
            newPreferredCol = null;
            newVisualCol = 0;
            break;
          case 'end':
            newPreferredCol = null;
            newVisualCol = currentVisLineLen;
            break;
          default: {
            const exhaustiveCheck: never = dir;
            debugLogger.error(
              `Unknown visual movement direction: ${exhaustiveCheck}`,
            );
            return state;
          }
        }

        if (visualToLogicalMap[newVisualRow]) {
          const [logRow, logicalStartCol] = visualToLogicalMap[newVisualRow];
          const transformedToLogicalMap =
            visualLayout.transformedToLogicalMaps?.[logRow] ?? [];
          let transformedStartCol = 0;
          while (
            transformedStartCol < transformedToLogicalMap.length &&
            transformedToLogicalMap[transformedStartCol] < logicalStartCol
          ) {
            transformedStartCol++;
          }
          const clampedTransformedCol = Math.min(
            transformedStartCol + newVisualCol,
            Math.max(0, transformedToLogicalMap.length - 1),
          );
          const newLogicalCol =
            transformedToLogicalMap[clampedTransformedCol] ??
            cpLen(lines[logRow] ?? '');
          return {
            ...state,
            cursorRow: logRow,
            cursorCol: newLogicalCol,
            preferredCol: newPreferredCol,
          };
        }
        return state;
      }

      // Logical movements
      switch (dir) {
        case 'wordLeft': {
          if (cursorCol === 0 && cursorRow === 0) return state;

          let newCursorRow = cursorRow;
          let newCursorCol = cursorCol;

          if (cursorCol === 0) {
            newCursorRow--;
            newCursorCol = cpLen(lines[newCursorRow] ?? '');
          } else {
            const lineContent = lines[cursorRow];
            newCursorCol = findPrevWordBoundary(lineContent, cursorCol);
          }
          return {
            ...state,
            cursorRow: newCursorRow,
            cursorCol: newCursorCol,
            preferredCol: null,
          };
        }
        case 'wordRight': {
          const lineContent = lines[cursorRow] ?? '';
          if (
            cursorRow === lines.length - 1 &&
            cursorCol === cpLen(lineContent)
          ) {
            return state;
          }

          let newCursorRow = cursorRow;
          let newCursorCol = cursorCol;
          const lineLen = cpLen(lineContent);

          if (cursorCol >= lineLen) {
            newCursorRow++;
            newCursorCol = 0;
          } else {
            newCursorCol = findNextWordBoundary(lineContent, cursorCol);
          }
          return {
            ...state,
            cursorRow: newCursorRow,
            cursorCol: newCursorCol,
            preferredCol: null,
          };
        }
        default:
          return state;
      }
    }

    case 'set_cursor': {
      return {
        ...state,
        ...action.payload,
      };
    }

    case 'delete': {
      const stateWithUndo = pushUndoLocal(state);
      const currentState = detachExpandedPaste(stateWithUndo);
      const { cursorRow, cursorCol, lines, transformationsByLine } =
        currentState;

      // Check if cursor is at start of an atomic placeholder
      const transformations = transformationsByLine[cursorRow] ?? [];
      const placeholder = findAtomicPlaceholderForDelete(
        lines[cursorRow],
        cursorCol,
        transformations,
      );

      if (placeholder) {
        const nextState = currentState;
        const newLines = [...nextState.lines];
        newLines[cursorRow] =
          cpSlice(newLines[cursorRow], 0, placeholder.start) +
          cpSlice(newLines[cursorRow], placeholder.end);

        // Recalculate transformations for the modified line
        const newTransformations = [...nextState.transformationsByLine];
        newTransformations[cursorRow] = calculateTransformationsForLine(
          newLines[cursorRow],
        );

        // Clean up pastedContent if this was a paste placeholder
        let newPastedContent = nextState.pastedContent;
        if (placeholder.type === 'paste' && placeholder.id) {
          const { [placeholder.id]: _, ...remaining } = nextState.pastedContent;
          newPastedContent = remaining;
        }

        return {
          ...nextState,
          lines: newLines,
          // cursorCol stays the same
          preferredCol: null,
          transformationsByLine: newTransformations,
          pastedContent: newPastedContent,
        };
      }

      // Standard delete logic
      const lineContent = currentLine(cursorRow);
      let lineDelta = 0;
      const nextState = currentState;
      const newLines = [...nextState.lines];

      if (cursorCol < currentLineLen(cursorRow)) {
        newLines[cursorRow] =
          cpSlice(lineContent, 0, cursorCol) +
          cpSlice(lineContent, cursorCol + 1);
      } else if (cursorRow < lines.length - 1) {
        const nextLineContent = currentLine(cursorRow + 1);
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        lineDelta = -1;
      } else {
        return currentState;
      }

      const { newInfo: newExpandedPaste, isDetached } = shiftExpandedRegions(
        nextState.expandedPaste,
        nextState.cursorRow,
        lineDelta,
        nextState.cursorRow + (lineDelta < 0 ? 1 : 0),
      );

      const newPastedContent = { ...nextState.pastedContent };
      if (isDetached && nextState.expandedPaste) {
        delete newPastedContent[nextState.expandedPaste.id];
      }

      return {
        ...nextState,
        lines: newLines,
        preferredCol: null,
        pastedContent: newPastedContent,
        expandedPaste: newExpandedPaste,
      };
    }

    case 'delete_word_left': {
      const stateWithUndo = pushUndoLocal(state);
      const currentState = detachExpandedPaste(stateWithUndo);
      const { cursorRow, cursorCol } = currentState;
      if (cursorCol === 0 && cursorRow === 0) return currentState;

      const nextState = currentState;
      const newLines = [...nextState.lines];
      let newCursorRow = cursorRow;
      let newCursorCol = cursorCol;

      if (newCursorCol > 0) {
        const lineContent = currentLine(newCursorRow);
        const prevWordStart = findPrevWordStartInLine(
          lineContent,
          newCursorCol,
        );
        const start = prevWordStart === null ? 0 : prevWordStart;
        newLines[newCursorRow] =
          cpSlice(lineContent, 0, start) + cpSlice(lineContent, newCursorCol);
        newCursorCol = start;
      } else {
        // Act as a backspace
        const prevLineContent = currentLine(cursorRow - 1);
        const currentLineContentVal = currentLine(cursorRow);
        const newCol = cpLen(prevLineContent);
        newLines[cursorRow - 1] = prevLineContent + currentLineContentVal;
        newLines.splice(cursorRow, 1);
        newCursorRow--;
        newCursorCol = newCol;
      }

      return {
        ...nextState,
        lines: newLines,
        cursorRow: newCursorRow,
        cursorCol: newCursorCol,
        preferredCol: null,
      };
    }

    case 'delete_word_right': {
      const stateWithUndo = pushUndoLocal(state);
      const currentState = detachExpandedPaste(stateWithUndo);
      const { cursorRow, cursorCol, lines } = currentState;
      const lineContent = currentLine(cursorRow);
      const lineLen = cpLen(lineContent);

      if (cursorCol >= lineLen && cursorRow === lines.length - 1) {
        return currentState;
      }

      const nextState = currentState;
      const newLines = [...nextState.lines];

      if (cursorCol >= lineLen) {
        // Act as a delete, joining with the next line
        const nextLineContent = currentLine(cursorRow + 1);
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
      } else {
        const nextWordStart = findNextWordStartInLine(lineContent, cursorCol);
        const end = nextWordStart === null ? lineLen : nextWordStart;
        newLines[cursorRow] =
          cpSlice(lineContent, 0, cursorCol) + cpSlice(lineContent, end);
      }

      return {
        ...nextState,
        lines: newLines,
        preferredCol: null,
      };
    }

    case 'kill_line_right': {
      const stateWithUndo = pushUndoLocal(state);
      const currentState = detachExpandedPaste(stateWithUndo);
      const { cursorRow, cursorCol, lines } = currentState;
      const lineContent = currentLine(cursorRow);
      if (cursorCol < currentLineLen(cursorRow)) {
        const nextState = currentState;
        const newLines = [...nextState.lines];
        newLines[cursorRow] = cpSlice(lineContent, 0, cursorCol);
        return {
          ...nextState,
          lines: newLines,
        };
      } else if (cursorRow < lines.length - 1) {
        // Act as a delete
        const nextState = currentState;
        const nextLineContent = currentLine(cursorRow + 1);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        return {
          ...nextState,
          lines: newLines,
          preferredCol: null,
        };
      }
      return currentState;
    }

    case 'kill_line_left': {
      const stateWithUndo = pushUndoLocal(state);
      const currentState = detachExpandedPaste(stateWithUndo);
      const { cursorRow, cursorCol } = currentState;
      if (cursorCol > 0) {
        const nextState = currentState;
        const lineContent = currentLine(cursorRow);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = cpSlice(lineContent, cursorCol);
        return {
          ...nextState,
          lines: newLines,
          cursorCol: 0,
          preferredCol: null,
        };
      }
      return currentState;
    }

    case 'undo': {
      const stateToRestore = state.undoStack[state.undoStack.length - 1];
      if (!stateToRestore) return state;

      const currentSnapshot: UndoHistoryEntry = {
        lines: [...state.lines],
        cursorRow: state.cursorRow,
        cursorCol: state.cursorCol,
        pastedContent: { ...state.pastedContent },
        expandedPaste: state.expandedPaste ? { ...state.expandedPaste } : null,
      };
      return {
        ...state,
        ...stateToRestore,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentSnapshot],
      };
    }

    case 'redo': {
      const stateToRestore = state.redoStack[state.redoStack.length - 1];
      if (!stateToRestore) return state;

      const currentSnapshot: UndoHistoryEntry = {
        lines: [...state.lines],
        cursorRow: state.cursorRow,
        cursorCol: state.cursorCol,
        pastedContent: { ...state.pastedContent },
        expandedPaste: state.expandedPaste ? { ...state.expandedPaste } : null,
      };
      return {
        ...state,
        ...stateToRestore,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, currentSnapshot],
      };
    }

    case 'replace_range': {
      const { startRow, startCol, endRow, endCol, text } = action.payload;
      const nextState = pushUndoLocal(state);
      const newState = replaceRangeInternal(
        nextState,
        startRow,
        startCol,
        endRow,
        endCol,
        text,
      );

      const oldLineCount = endRow - startRow + 1;
      const newLineCount =
        newState.lines.length - (nextState.lines.length - oldLineCount);
      const lineDelta = newLineCount - oldLineCount;

      const { newInfo: newExpandedPaste, isDetached } = shiftExpandedRegions(
        nextState.expandedPaste,
        startRow,
        lineDelta,
        endRow,
      );

      const newPastedContent = { ...newState.pastedContent };
      if (isDetached && nextState.expandedPaste) {
        delete newPastedContent[nextState.expandedPaste.id];
      }

      return {
        ...newState,
        pastedContent: newPastedContent,
        expandedPaste: newExpandedPaste,
      };
    }

    case 'move_to_offset': {
      const { offset } = action.payload;
      const [newRow, newCol] = offsetToLogicalPos(
        state.lines.join('\n'),
        offset,
      );
      return {
        ...state,
        cursorRow: newRow,
        cursorCol: newCol,
        preferredCol: null,
      };
    }

    case 'create_undo_snapshot': {
      return pushUndoLocal(state);
    }

    // Vim-specific operations
    case 'vim_delete_word_forward':
    case 'vim_delete_word_backward':
    case 'vim_delete_word_end':
    case 'vim_change_word_forward':
    case 'vim_change_word_backward':
    case 'vim_change_word_end':
    case 'vim_delete_line':
    case 'vim_change_line':
    case 'vim_delete_to_end_of_line':
    case 'vim_change_to_end_of_line':
    case 'vim_change_movement':
    case 'vim_move_left':
    case 'vim_move_right':
    case 'vim_move_up':
    case 'vim_move_down':
    case 'vim_move_word_forward':
    case 'vim_move_word_backward':
    case 'vim_move_word_end':
    case 'vim_delete_char':
    case 'vim_insert_at_cursor':
    case 'vim_append_at_cursor':
    case 'vim_open_line_below':
    case 'vim_open_line_above':
    case 'vim_append_at_line_end':
    case 'vim_insert_at_line_start':
    case 'vim_move_to_line_start':
    case 'vim_move_to_line_end':
    case 'vim_move_to_first_nonwhitespace':
    case 'vim_move_to_first_line':
    case 'vim_move_to_last_line':
    case 'vim_move_to_line':
    case 'vim_escape_insert_mode':
      return handleVimAction(state, action as VimAction);

    case 'toggle_paste_expansion': {
      const { id, row, col } = action.payload;
      const expandedPaste = state.expandedPaste;

      if (expandedPaste && expandedPaste.id === id) {
        const nextState = pushUndoLocal(state);
        // COLLAPSE: Restore original line with placeholder
        const newLines = [...nextState.lines];
        newLines.splice(
          expandedPaste.startLine,
          expandedPaste.lineCount,
          expandedPaste.prefix + id + expandedPaste.suffix,
        );

        // Move cursor to end of collapsed placeholder
        const newCursorRow = expandedPaste.startLine;
        const newCursorCol = cpLen(expandedPaste.prefix) + cpLen(id);

        return {
          ...nextState,
          lines: newLines,
          cursorRow: newCursorRow,
          cursorCol: newCursorCol,
          preferredCol: null,
          expandedPaste: null,
        };
      } else {
        // EXPAND: Replace placeholder with content

        // Collapse any existing expanded paste first
        let currentState = state;
        let targetRow = row;
        if (state.expandedPaste) {
          const existingInfo = state.expandedPaste;
          const lineDelta = 1 - existingInfo.lineCount;

          if (targetRow !== undefined && targetRow > existingInfo.startLine) {
            // If we collapsed something above our target, our target row shifted up
            targetRow += lineDelta;
          }

          currentState = textBufferReducerLogic(state, {
            type: 'toggle_paste_expansion',
            payload: {
              id: existingInfo.id,
              row: existingInfo.startLine,
              col: 0,
            },
          });
          // Update transformations because they are needed for finding the next placeholder
          currentState.transformationsByLine = calculateTransformations(
            currentState.lines,
          );
        }

        const content = currentState.pastedContent[id];
        if (!content) return currentState;

        // Find line and position containing exactly this placeholder
        let lineIndex = -1;
        let placeholderStart = -1;

        const tryFindOnLine = (idx: number) => {
          const transforms = currentState.transformationsByLine[idx] ?? [];

          // Precise match by col
          let transform = transforms.find(
            (t) =>
              t.type === 'paste' &&
              t.id === id &&
              col >= t.logStart &&
              col <= t.logEnd,
          );

          if (!transform) {
            // Fallback to first match on line
            transform = transforms.find(
              (t) => t.type === 'paste' && t.id === id,
            );
          }

          if (transform) {
            lineIndex = idx;
            placeholderStart = transform.logStart;
            return true;
          }
          return false;
        };

        // Try provided row first for precise targeting
        if (targetRow >= 0 && targetRow < currentState.lines.length) {
          tryFindOnLine(targetRow);
        }

        if (lineIndex === -1) {
          for (let i = 0; i < currentState.lines.length; i++) {
            if (tryFindOnLine(i)) break;
          }
        }

        if (lineIndex === -1) return currentState;

        const nextState = pushUndoLocal(currentState);

        const line = nextState.lines[lineIndex];
        const prefix = cpSlice(line, 0, placeholderStart);
        const suffix = cpSlice(line, placeholderStart + cpLen(id));

        // Split content into lines
        const contentLines = content.split('\n');
        const newLines = [...nextState.lines];

        let expandedLines: string[];
        if (contentLines.length === 1) {
          // Single-line content
          expandedLines = [prefix + contentLines[0] + suffix];
        } else {
          // Multi-line content
          expandedLines = [
            prefix + contentLines[0],
            ...contentLines.slice(1, -1),
            contentLines[contentLines.length - 1] + suffix,
          ];
        }

        newLines.splice(lineIndex, 1, ...expandedLines);

        // Move cursor to end of expanded content (before suffix)
        const newCursorRow = lineIndex + expandedLines.length - 1;
        const lastExpandedLine = expandedLines[expandedLines.length - 1];
        const newCursorCol = cpLen(lastExpandedLine) - cpLen(suffix);

        return {
          ...nextState,
          lines: newLines,
          cursorRow: newCursorRow,
          cursorCol: newCursorCol,
          preferredCol: null,
          expandedPaste: {
            id,
            startLine: lineIndex,
            lineCount: expandedLines.length,
            prefix,
            suffix,
          },
        };
      }
    }

    default: {
      const exhaustiveCheck: never = action;
      debugLogger.error(`Unknown action encountered: ${exhaustiveCheck}`);
      return state;
    }
  }
}

export function textBufferReducer(
  state: TextBufferState,
  action: TextBufferAction,
  options: TextBufferOptions = {},
): TextBufferState {
  const newState = textBufferReducerLogic(state, action, options);

  const newTransformedLines =
    newState.lines !== state.lines
      ? calculateTransformations(newState.lines)
      : state.transformationsByLine;

  const oldTransform = getTransformUnderCursor(
    state.cursorRow,
    state.cursorCol,
    state.transformationsByLine,
  );
  const newTransform = getTransformUnderCursor(
    newState.cursorRow,
    newState.cursorCol,
    newTransformedLines,
  );
  const oldInside = oldTransform !== null;
  const newInside = newTransform !== null;
  const movedBetweenTransforms =
    oldTransform !== newTransform &&
    (oldTransform !== null || newTransform !== null);

  if (
    newState.lines !== state.lines ||
    newState.viewportWidth !== state.viewportWidth ||
    oldInside !== newInside ||
    movedBetweenTransforms
  ) {
    const shouldResetPreferred =
      oldInside !== newInside || movedBetweenTransforms;

    return {
      ...newState,
      preferredCol: shouldResetPreferred ? null : newState.preferredCol,
      visualLayout: calculateLayout(newState.lines, newState.viewportWidth, [
        newState.cursorRow,
        newState.cursorCol,
      ]),
      transformationsByLine: newTransformedLines,
    };
  }

  return newState;
}
