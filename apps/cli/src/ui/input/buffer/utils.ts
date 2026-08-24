/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { unescapePath } from '@cofy-x/dsh-console-core';
import {
  toCodePoints,
  cpLen,
  getCachedStringWidth,
  cpSlice,
} from '../../../text/processing.js';
import {
  PASTED_TEXT_PLACEHOLDER_REGEX,
  type AtomicPlaceholder,
  type ExpandedPasteInfo,
  type TextBufferState,
  type Transformation,
  type VisualLayout,
} from './types.js';
import * as path from 'node:path';
import { LRUCache } from 'mnemonist';
import { LRU_BUFFER_PERF_CACHE_LIMIT } from '../../../utils/constants.js';

// Helper functions for line-based word navigation
export const isWordCharStrict = (char: string): boolean =>
  /[\w\p{L}\p{N}]/u.test(char); // Matches a single character that is any Unicode letter, any Unicode number, or an underscore

export const isWhitespace = (char: string): boolean => /\s/.test(char);

// Check if a character is a combining mark (only diacritics for now)
export const isCombiningMark = (char: string): boolean => /\p{M}/u.test(char);

// Check if a character should be considered part of a word (including combining marks)
export const isWordCharWithCombining = (char: string): boolean =>
  isWordCharStrict(char) || isCombiningMark(char);

// Get the script of a character (simplified for common scripts)
export const getCharScript = (char: string): string => {
  if (/[\p{Script=Latin}]/u.test(char)) return 'latin'; // All Latin script chars including diacritics
  if (/[\p{Script=Han}]/u.test(char)) return 'han'; // Chinese
  if (/[\p{Script=Arabic}]/u.test(char)) return 'arabic';
  if (/[\p{Script=Hiragana}]/u.test(char)) return 'hiragana';
  if (/[\p{Script=Katakana}]/u.test(char)) return 'katakana';
  if (/[\p{Script=Cyrillic}]/u.test(char)) return 'cyrillic';
  return 'other';
};

// Check if two characters are from different scripts (indicating word boundary)
export const isDifferentScript = (char1: string, char2: string): boolean => {
  if (!isWordCharStrict(char1) || !isWordCharStrict(char2)) return false;
  return getCharScript(char1) !== getCharScript(char2);
};

// Find next word start within a line, starting from col
export const findNextWordStartInLine = (
  line: string,
  col: number,
): number | null => {
  const chars = toCodePoints(line);
  let i = col;

  if (i >= chars.length) return null;

  const currentChar = chars[i];

  // Skip current word/sequence based on character type
  if (isWordCharStrict(currentChar)) {
    while (i < chars.length && isWordCharWithCombining(chars[i])) {
      // Check for script boundary - if next character is from different script, stop here
      if (
        i + 1 < chars.length &&
        isWordCharStrict(chars[i + 1]) &&
        isDifferentScript(chars[i], chars[i + 1])
      ) {
        i++; // Include current character
        break; // Stop at script boundary
      }
      i++;
    }
  } else if (!isWhitespace(currentChar)) {
    while (
      i < chars.length &&
      !isWordCharStrict(chars[i]) &&
      !isWhitespace(chars[i])
    ) {
      i++;
    }
  }

  // Skip whitespace
  while (i < chars.length && isWhitespace(chars[i])) {
    i++;
  }

  return i < chars.length ? i : null;
};

// Find previous word start within a line
export const findPrevWordStartInLine = (
  line: string,
  col: number,
): number | null => {
  const chars = toCodePoints(line);
  let i = col;

  if (i <= 0) return null;

  i--;

  // Skip whitespace moving backwards
  while (i >= 0 && isWhitespace(chars[i])) {
    i--;
  }

  if (i < 0) return null;

  if (isWordCharStrict(chars[i])) {
    // We're in a word, move to its beginning
    while (i >= 0 && isWordCharStrict(chars[i])) {
      // Check for script boundary - if previous character is from different script, stop here
      if (
        i - 1 >= 0 &&
        isWordCharStrict(chars[i - 1]) &&
        isDifferentScript(chars[i], chars[i - 1])
      ) {
        return i; // Return current position at script boundary
      }
      i--;
    }
    return i + 1;
  } else {
    // We're in punctuation, move to its beginning
    while (i >= 0 && !isWordCharStrict(chars[i]) && !isWhitespace(chars[i])) {
      i--;
    }
    return i + 1;
  }
};

// Find word end within a line
export const findWordEndInLine = (line: string, col: number): number | null => {
  const chars = toCodePoints(line);
  let i = col;

  // If we're already at the end of a word (including punctuation sequences), advance to next word
  // This includes both regular word endings and script boundaries
  const atEndOfWordChar =
    i < chars.length &&
    isWordCharWithCombining(chars[i]) &&
    (i + 1 >= chars.length ||
      !isWordCharWithCombining(chars[i + 1]) ||
      (isWordCharStrict(chars[i]) &&
        i + 1 < chars.length &&
        isWordCharStrict(chars[i + 1]) &&
        isDifferentScript(chars[i], chars[i + 1])));

  const atEndOfPunctuation =
    i < chars.length &&
    !isWordCharWithCombining(chars[i]) &&
    !isWhitespace(chars[i]) &&
    (i + 1 >= chars.length ||
      isWhitespace(chars[i + 1]) ||
      isWordCharWithCombining(chars[i + 1]));

  if (atEndOfWordChar || atEndOfPunctuation) {
    // We're at the end of a word or punctuation sequence, move forward to find next word
    i++;
    // Skip whitespace to find next word or punctuation
    while (i < chars.length && isWhitespace(chars[i])) {
      i++;
    }
  }

  // If we're not on a word character, find the next word or punctuation sequence
  if (i < chars.length && !isWordCharWithCombining(chars[i])) {
    // Skip whitespace to find next word or punctuation
    while (i < chars.length && isWhitespace(chars[i])) {
      i++;
    }
  }

  // Move to end of current word (including combining marks, but stop at script boundaries)
  let foundWord = false;
  let lastBaseCharPos = -1;

  if (i < chars.length && isWordCharWithCombining(chars[i])) {
    // Handle word characters
    while (i < chars.length && isWordCharWithCombining(chars[i])) {
      foundWord = true;

      // Track the position of the last base character (not combining mark)
      if (isWordCharStrict(chars[i])) {
        lastBaseCharPos = i;
      }

      // Check if next character is from a different script (word boundary)
      if (
        i + 1 < chars.length &&
        isWordCharStrict(chars[i + 1]) &&
        isDifferentScript(chars[i], chars[i + 1])
      ) {
        i++; // Include current character
        if (isWordCharStrict(chars[i - 1])) {
          lastBaseCharPos = i - 1;
        }
        break; // Stop at script boundary
      }

      i++;
    }
  } else if (i < chars.length && !isWhitespace(chars[i])) {
    // Handle punctuation sequences (like ████)
    while (
      i < chars.length &&
      !isWordCharStrict(chars[i]) &&
      !isWhitespace(chars[i])
    ) {
      foundWord = true;
      lastBaseCharPos = i;
      i++;
    }
  }

  // Only return a position if we actually found a word
  // Return the position of the last base character, not combining marks
  if (foundWord && lastBaseCharPos >= col) {
    return lastBaseCharPos;
  }

  return null;
};

// Initialize segmenter for word boundary detection
const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

export function findPrevWordBoundary(line: string, cursorCol: number): number {
  const codePoints = toCodePoints(line);
  // Convert cursorCol (CP index) to string index
  const prefix = codePoints.slice(0, cursorCol).join('');
  const cursorIdx = prefix.length;

  let targetIdx = 0;

  for (const seg of segmenter.segment(line)) {
    // We want the last word start strictly before the cursor.
    // If we've reached or passed the cursor, we stop.
    if (seg.index >= cursorIdx) break;

    if (seg.isWordLike) {
      targetIdx = seg.index;
    }
  }

  return toCodePoints(line.slice(0, targetIdx)).length;
}

export function findNextWordBoundary(line: string, cursorCol: number): number {
  const codePoints = toCodePoints(line);
  const prefix = codePoints.slice(0, cursorCol).join('');
  const cursorIdx = prefix.length;

  let targetIdx = line.length;

  for (const seg of segmenter.segment(line)) {
    const segEnd = seg.index + seg.segment.length;

    if (segEnd > cursorIdx) {
      if (seg.isWordLike) {
        targetIdx = segEnd;
        break;
      }
    }
  }

  return toCodePoints(line.slice(0, targetIdx)).length;
}

// Find next word across lines
export const findNextWordAcrossLines = (
  lines: string[],
  cursorRow: number,
  cursorCol: number,
  searchForWordStart: boolean,
): { row: number; col: number } | null => {
  // First try current line
  const currentLine = lines[cursorRow] || '';
  const colInCurrentLine = searchForWordStart
    ? findNextWordStartInLine(currentLine, cursorCol)
    : findWordEndInLine(currentLine, cursorCol);

  if (colInCurrentLine !== null) {
    return { row: cursorRow, col: colInCurrentLine };
  }

  // Search subsequent lines
  for (let row = cursorRow + 1; row < lines.length; row++) {
    const line = lines[row] || '';
    const chars = toCodePoints(line);

    // For empty lines, if we haven't found any words yet, return the empty line
    if (chars.length === 0) {
      // Check if there are any words in remaining lines
      let hasWordsInLaterLines = false;
      for (let laterRow = row + 1; laterRow < lines.length; laterRow++) {
        const laterLine = lines[laterRow] || '';
        const laterChars = toCodePoints(laterLine);
        let firstNonWhitespace = 0;
        while (
          firstNonWhitespace < laterChars.length &&
          isWhitespace(laterChars[firstNonWhitespace])
        ) {
          firstNonWhitespace++;
        }
        if (firstNonWhitespace < laterChars.length) {
          hasWordsInLaterLines = true;
          break;
        }
      }

      // If no words in later lines, return the empty line
      if (!hasWordsInLaterLines) {
        return { row, col: 0 };
      }
      continue;
    }

    // Find first non-whitespace
    let firstNonWhitespace = 0;
    while (
      firstNonWhitespace < chars.length &&
      isWhitespace(chars[firstNonWhitespace])
    ) {
      firstNonWhitespace++;
    }

    if (firstNonWhitespace < chars.length) {
      if (searchForWordStart) {
        return { row, col: firstNonWhitespace };
      } else {
        // For word end, find the end of the first word
        const endCol = findWordEndInLine(line, firstNonWhitespace);
        if (endCol !== null) {
          return { row, col: endCol };
        }
      }
    }
  }

  return null;
};

// Find previous word across lines
export const findPrevWordAcrossLines = (
  lines: string[],
  cursorRow: number,
  cursorCol: number,
): { row: number; col: number } | null => {
  // First try current line
  const currentLine = lines[cursorRow] || '';
  const colInCurrentLine = findPrevWordStartInLine(currentLine, cursorCol);

  if (colInCurrentLine !== null) {
    return { row: cursorRow, col: colInCurrentLine };
  }

  // Search previous lines
  for (let row = cursorRow - 1; row >= 0; row--) {
    const line = lines[row] || '';
    const chars = toCodePoints(line);

    if (chars.length === 0) continue;

    // Find last word start
    let lastWordStart = chars.length;
    while (lastWordStart > 0 && isWhitespace(chars[lastWordStart - 1])) {
      lastWordStart--;
    }

    if (lastWordStart > 0) {
      // Find start of this word
      const wordStart = findPrevWordStartInLine(line, lastWordStart);
      if (wordStart !== null) {
        return { row, col: wordStart };
      }
    }
  }

  return null;
};

// Helper functions for vim line operations
export const getPositionFromOffsets = (
  startOffset: number,
  endOffset: number,
  lines: string[],
) => {
  let offset = 0;
  let startRow = 0;
  let startCol = 0;
  let endRow = 0;
  let endCol = 0;

  // Find start position
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (offset + lineLength > startOffset) {
      startRow = i;
      startCol = startOffset - offset;
      break;
    }
    offset += lineLength;
  }

  // Find end position
  offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + (i < lines.length - 1 ? 1 : 0); // +1 for newline except last line
    if (offset + lineLength >= endOffset) {
      endRow = i;
      endCol = endOffset - offset;
      break;
    }
    offset += lineLength;
  }

  return { startRow, startCol, endRow, endCol };
};

export const getLineRangeOffsets = (
  startRow: number,
  lineCount: number,
  lines: string[],
) => {
  let startOffset = 0;

  // Calculate start offset
  for (let i = 0; i < startRow; i++) {
    startOffset += lines[i].length + 1; // +1 for newline
  }

  // Calculate end offset
  let endOffset = startOffset;
  for (let i = 0; i < lineCount; i++) {
    const lineIndex = startRow + i;
    if (lineIndex < lines.length) {
      endOffset += lines[lineIndex].length;
      if (lineIndex < lines.length - 1) {
        endOffset += 1; // +1 for newline
      }
    }
  }

  return { startOffset, endOffset };
};

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function calculateInitialCursorPosition(
  initialLines: string[],
  offset: number,
): [number, number] {
  let remainingChars = offset;
  let row = 0;
  while (row < initialLines.length) {
    const lineLength = cpLen(initialLines[row]);
    // Add 1 for the newline character (except for the last line)
    const totalCharsInLineAndNewline =
      lineLength + (row < initialLines.length - 1 ? 1 : 0);

    if (remainingChars <= lineLength) {
      // Cursor is on this line
      return [row, remainingChars];
    }
    remainingChars -= totalCharsInLineAndNewline;
    row++;
  }
  // Offset is beyond the text, place cursor at the end of the last line
  if (initialLines.length > 0) {
    const lastRow = initialLines.length - 1;
    return [lastRow, cpLen(initialLines[lastRow])];
  }
  return [0, 0]; // Default for empty text
}

export function offsetToLogicalPos(
  text: string,
  offset: number,
): [number, number] {
  let row = 0;
  let col = 0;
  let currentOffset = 0;

  if (offset === 0) return [0, 0];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = cpLen(line);
    const lineLengthWithNewline = lineLength + (i < lines.length - 1 ? 1 : 0);

    if (offset <= currentOffset + lineLength) {
      // Check against lineLength first
      row = i;
      col = offset - currentOffset;
      return [row, col];
    } else if (offset <= currentOffset + lineLengthWithNewline) {
      // Check if offset is the newline itself
      row = i;
      col = lineLength; // Position cursor at the end of the current line content
      // If the offset IS the newline, and it's not the last line, advance to next line, col 0
      if (
        offset === currentOffset + lineLengthWithNewline &&
        i < lines.length - 1
      ) {
        return [i + 1, 0];
      }
      return [row, col]; // Otherwise, it's at the end of the current line content
    }
    currentOffset += lineLengthWithNewline;
  }

  // If offset is beyond the text length, place cursor at the end of the last line
  // or [0,0] if text is empty
  if (lines.length > 0) {
    row = lines.length - 1;
    col = cpLen(lines[row]);
  } else {
    row = 0;
    col = 0;
  }
  return [row, col];
}

/**
 * Converts logical row/col position to absolute text offset
 * Inverse operation of offsetToLogicalPos
 */
export function logicalPosToOffset(
  lines: string[],
  row: number,
  col: number,
): number {
  let offset = 0;

  // Clamp row to valid range
  const actualRow = Math.min(row, lines.length - 1);

  // Add lengths of all lines before the target row
  for (let i = 0; i < actualRow; i++) {
    offset += cpLen(lines[i]) + 1; // +1 for newline
  }

  // Add column offset within the target row
  if (actualRow >= 0 && actualRow < lines.length) {
    offset += Math.min(col, cpLen(lines[actualRow]));
  }

  return offset;
}

export const imagePathRegex =
  /@((?:\\.|[^\s\r\n\\])+?\.(?:png|jpg|jpeg|gif|webp|svg|bmp))\b/gi;

export function getTransformedImagePath(filePath: string): string {
  const raw = filePath;

  // Ignore leading @ when stripping directories, but keep it for simple '@file.png'
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw;

  // Unescape the path to handle escaped spaces and other characters
  const unescaped = unescapePath(withoutAt);

  // Find last directory separator, supporting both POSIX and Windows styles
  const lastSepIndex = Math.max(
    unescaped.lastIndexOf('/'),
    unescaped.lastIndexOf('\\'),
  );

  // If we saw a separator, take the segment after it; otherwise fall back to the unescaped string
  const fileName =
    lastSepIndex >= 0 ? unescaped.slice(lastSepIndex + 1) : unescaped;

  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  const maxBaseLength = 10;

  const truncatedBase =
    baseName.length > maxBaseLength
      ? `...${baseName.slice(-maxBaseLength)}`
      : baseName;

  return `[Image ${truncatedBase}${extension}]`;
}

const transformationsCache = new LRUCache<string, Transformation[]>(
  LRU_BUFFER_PERF_CACHE_LIMIT,
);

export function calculateTransformationsForLine(
  line: string,
): Transformation[] {
  const cached = transformationsCache.get(line);
  if (cached) {
    return cached;
  }

  const transformations: Transformation[] = [];

  // 1. Detect image paths
  imagePathRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = imagePathRegex.exec(line)) !== null) {
    const logicalText = match[0];
    const logStart = cpLen(line.substring(0, match.index));
    const logEnd = logStart + cpLen(logicalText);

    transformations.push({
      logStart,
      logEnd,
      logicalText,
      collapsedText: getTransformedImagePath(logicalText),
      type: 'image',
    });
  }

  // 2. Detect paste placeholders
  const pasteRegex = new RegExp(PASTED_TEXT_PLACEHOLDER_REGEX.source, 'g');
  while ((match = pasteRegex.exec(line)) !== null) {
    const logicalText = match[0];
    const logStart = cpLen(line.substring(0, match.index));
    const logEnd = logStart + cpLen(logicalText);

    transformations.push({
      logStart,
      logEnd,
      logicalText,
      collapsedText: logicalText,
      type: 'paste',
      id: logicalText,
    });
  }

  // Sort transformations by logStart to maintain consistency
  transformations.sort((a, b) => a.logStart - b.logStart);

  transformationsCache.set(line, transformations);

  return transformations;
}

export function calculateTransformations(lines: string[]): Transformation[][] {
  return lines.map((ln) => calculateTransformationsForLine(ln));
}

export function getTransformUnderCursor(
  row: number,
  col: number,
  spansByLine: Transformation[][],
): Transformation | null {
  const spans = spansByLine[row];
  if (!spans || spans.length === 0) return null;
  for (const span of spans) {
    if (col >= span.logStart && col < span.logEnd) {
      return span;
    }
    if (col < span.logStart) break;
  }
  return null;
}

/**
 * Check if a line index falls within an expanded paste region.
 * Returns the paste placeholder ID if found, null otherwise.
 */
export function getExpandedPasteAtLine(
  lineIndex: number,
  expandedPaste: ExpandedPasteInfo | null,
): string | null {
  if (
    expandedPaste &&
    lineIndex >= expandedPaste.startLine &&
    lineIndex < expandedPaste.startLine + expandedPaste.lineCount
  ) {
    return expandedPaste.id;
  }
  return null;
}

/**
 * Surgery for expanded paste regions when lines are added or removed.
 * Adjusts startLine indices and detaches any region that is partially or fully deleted.
 */
export function shiftExpandedRegions(
  expandedPaste: ExpandedPasteInfo | null,
  changeStartLine: number,
  lineDelta: number,
  changeEndLine?: number, // Inclusive
): {
  newInfo: ExpandedPasteInfo | null;
  isDetached: boolean;
} {
  if (!expandedPaste) return { newInfo: null, isDetached: false };

  const effectiveEndLine = changeEndLine ?? changeStartLine;
  const infoEndLine = expandedPaste.startLine + expandedPaste.lineCount - 1;

  // 1. Check for overlap/intersection with the changed range
  const isOverlapping =
    changeStartLine <= infoEndLine &&
    effectiveEndLine >= expandedPaste.startLine;

  if (isOverlapping) {
    // If the change is a deletion (lineDelta < 0) that touches this region, we detach.
    // If it's an insertion, we only detach if it's a multi-line insertion (lineDelta > 0)
    // that isn't at the very start of the region (which would shift it).
    // Regular character typing (lineDelta === 0) does NOT detach.
    if (
      lineDelta < 0 ||
      (lineDelta > 0 &&
        changeStartLine > expandedPaste.startLine &&
        changeStartLine <= infoEndLine)
    ) {
      return { newInfo: null, isDetached: true };
    }
  }

  // 2. Shift regions that start at or after the change point
  if (expandedPaste.startLine >= changeStartLine) {
    return {
      newInfo: {
        ...expandedPaste,
        startLine: expandedPaste.startLine + lineDelta,
      },
      isDetached: false,
    };
  }

  return { newInfo: expandedPaste, isDetached: false };
}

/**
 * Detach any expanded paste region if the cursor is within it.
 * This converts the expanded content to regular text that can no longer be collapsed.
 * Returns the state unchanged if cursor is not in an expanded region.
 */
export function detachExpandedPaste(state: TextBufferState): TextBufferState {
  const expandedId = getExpandedPasteAtLine(
    state.cursorRow,
    state.expandedPaste,
  );
  if (!expandedId) return state;

  const { [expandedId]: _, ...newPastedContent } = state.pastedContent;
  return {
    ...state,
    expandedPaste: null,
    pastedContent: newPastedContent,
  };
}

/**
 * Find atomic placeholder at cursor for backspace (cursor at end).
 * Checks all placeholder types in priority order.
 */
export function findAtomicPlaceholderForBackspace(
  line: string,
  cursorCol: number,
  transformations: Transformation[],
): AtomicPlaceholder | null {
  // 1. Check paste placeholders (text-based)
  const pasteRegex = new RegExp(PASTED_TEXT_PLACEHOLDER_REGEX.source, 'g');
  let match;
  while ((match = pasteRegex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (cursorCol === end) {
      return { start, end, type: 'paste', id: match[0] };
    }
  }

  // 2. Check image transformations (logical bounds)
  for (const transform of transformations) {
    if (cursorCol === transform.logEnd) {
      return {
        start: transform.logStart,
        end: transform.logEnd,
        type: 'image',
      };
    }
  }

  return null;
}

/**
 * Find atomic placeholder at cursor for delete (cursor at start).
 */
export function findAtomicPlaceholderForDelete(
  _line: string,
  cursorCol: number,
  transformations: Transformation[],
): AtomicPlaceholder | null {
  for (const transform of transformations) {
    if (cursorCol === transform.logStart) {
      return {
        start: transform.logStart,
        end: transform.logEnd,
        type: transform.type,
        id: transform.id,
      };
    }
  }

  return null;
}

export function calculateTransformedLine(
  logLine: string,
  logIndex: number,
  logicalCursor: [number, number],
  transformations: Transformation[],
): { transformedLine: string; transformedToLogMap: number[] } {
  let transformedLine = '';
  const transformedToLogMap: number[] = [];
  let lastLogPos = 0;

  const cursorIsOnThisLine = logIndex === logicalCursor[0];
  const cursorCol = logicalCursor[1];

  for (const transform of transformations) {
    const textBeforeTransformation = cpSlice(
      logLine,
      lastLogPos,
      transform.logStart,
    );
    transformedLine += textBeforeTransformation;
    for (let i = 0; i < cpLen(textBeforeTransformation); i++) {
      transformedToLogMap.push(lastLogPos + i);
    }

    const isExpanded =
      transform.type === 'image' &&
      cursorIsOnThisLine &&
      cursorCol >= transform.logStart &&
      cursorCol <= transform.logEnd;
    const transformedText = isExpanded
      ? transform.logicalText
      : transform.collapsedText;
    transformedLine += transformedText;

    // Map transformed characters back to logical characters
    const transformedLen = cpLen(transformedText);
    if (isExpanded) {
      for (let i = 0; i < transformedLen; i++) {
        transformedToLogMap.push(transform.logStart + i);
      }
    } else {
      // Collapsed: distribute transformed positions monotonically across the raw span.
      // This preserves ordering across wrapped slices so logicalToVisualMap has
      // increasing startColInLogical and visual cursor mapping remains consistent.
      const logicalLength = Math.max(0, transform.logEnd - transform.logStart);
      for (let i = 0; i < transformedLen; i++) {
        // Map the i-th transformed code point into [logStart, logEnd)
        const transformationToLogicalOffset =
          logicalLength === 0
            ? 0
            : Math.floor((i * logicalLength) / transformedLen);
        const transformationToLogicalIndex =
          transform.logStart +
          Math.min(
            transformationToLogicalOffset,
            Math.max(logicalLength - 1, 0),
          );
        transformedToLogMap.push(transformationToLogicalIndex);
      }
    }
    lastLogPos = transform.logEnd;
  }

  // Append text after last transform
  const remainingUntransformedText = cpSlice(logLine, lastLogPos);
  transformedLine += remainingUntransformedText;
  for (let i = 0; i < cpLen(remainingUntransformedText); i++) {
    transformedToLogMap.push(lastLogPos + i);
  }

  // For a cursor at the very end of the transformed line
  transformedToLogMap.push(cpLen(logLine));

  return { transformedLine, transformedToLogMap };
}

// Caches for layout calculation
interface LineLayoutResult {
  visualLines: string[];
  logicalToVisualMap: Array<[number, number]>;
  visualToLogicalMap: Array<[number, number]>;
  transformedToLogMap: number[];
  visualToTransformedMap: number[];
}

const lineLayoutCache = new LRUCache<string, LineLayoutResult>(
  LRU_BUFFER_PERF_CACHE_LIMIT,
);

function getLineLayoutCacheKey(
  line: string,
  viewportWidth: number,
  isCursorOnLine: boolean,
  cursorCol: number,
): string {
  // Most lines (99.9% in a large buffer) are not cursor lines.
  // We use a simpler key for them to reduce string allocation overhead.
  if (!isCursorOnLine) {
    return `${viewportWidth}:N:${line}`;
  }
  return `${viewportWidth}:C:${cursorCol}:${line}`;
}

// Calculates the visual wrapping of lines and the mapping between logical and visual coordinates.
// This is an expensive operation and should be memoized.
export function calculateLayout(
  logicalLines: string[],
  viewportWidth: number,
  logicalCursor: [number, number],
): VisualLayout {
  const visualLines: string[] = [];
  const logicalToVisualMap: Array<Array<[number, number]>> = [];
  const visualToLogicalMap: Array<[number, number]> = [];
  const transformedToLogicalMaps: number[][] = [];
  const visualToTransformedMap: number[] = [];

  logicalLines.forEach((logLine, logIndex) => {
    logicalToVisualMap[logIndex] = [];

    const isCursorOnLine = logIndex === logicalCursor[0];
    const cacheKey = getLineLayoutCacheKey(
      logLine,
      viewportWidth,
      isCursorOnLine,
      logicalCursor[1],
    );
    const cached = lineLayoutCache.get(cacheKey);

    if (cached) {
      const visualLineOffset = visualLines.length;
      visualLines.push(...cached.visualLines);
      cached.logicalToVisualMap.forEach(([relVisualIdx, logCol]) => {
        logicalToVisualMap[logIndex].push([
          visualLineOffset + relVisualIdx,
          logCol,
        ]);
      });
      cached.visualToLogicalMap.forEach(([, logCol]) => {
        visualToLogicalMap.push([logIndex, logCol]);
      });
      transformedToLogicalMaps[logIndex] = cached.transformedToLogMap;
      visualToTransformedMap.push(...cached.visualToTransformedMap);
      return;
    }

    // Not in cache, calculate
    const transformations = calculateTransformationsForLine(logLine);
    const { transformedLine, transformedToLogMap } = calculateTransformedLine(
      logLine,
      logIndex,
      logicalCursor,
      transformations,
    );

    const lineVisualLines: string[] = [];
    const lineLogicalToVisualMap: Array<[number, number]> = [];
    const lineVisualToLogicalMap: Array<[number, number]> = [];
    const lineVisualToTransformedMap: number[] = [];

    if (transformedLine.length === 0) {
      // Handle empty logical line
      lineLogicalToVisualMap.push([0, 0]);
      lineVisualToLogicalMap.push([logIndex, 0]);
      lineVisualToTransformedMap.push(0);
      lineVisualLines.push('');
    } else {
      // Non-empty logical line
      let currentPosInLogLine = 0; // Tracks position within the current logical line (code point index)
      const codePointsInLogLine = toCodePoints(transformedLine);

      while (currentPosInLogLine < codePointsInLogLine.length) {
        let currentChunk = '';
        let currentChunkVisualWidth = 0;
        let numCodePointsInChunk = 0;
        let lastWordBreakPoint = -1; // Index in codePointsInLogLine for word break
        let numCodePointsAtLastWordBreak = 0;

        // Iterate through code points to build the current visual line (chunk)
        for (let i = currentPosInLogLine; i < codePointsInLogLine.length; i++) {
          const char = codePointsInLogLine[i];
          const charVisualWidth = getCachedStringWidth(char);

          if (currentChunkVisualWidth + charVisualWidth > viewportWidth) {
            // Character would exceed viewport width
            if (
              lastWordBreakPoint !== -1 &&
              numCodePointsAtLastWordBreak > 0 &&
              currentPosInLogLine + numCodePointsAtLastWordBreak < i
            ) {
              // We have a valid word break point to use, and it's not the start of the current segment
              currentChunk = codePointsInLogLine
                .slice(
                  currentPosInLogLine,
                  currentPosInLogLine + numCodePointsAtLastWordBreak,
                )
                .join('');
              numCodePointsInChunk = numCodePointsAtLastWordBreak;
            } else {
              // No word break, or word break is at the start of this potential chunk, or word break leads to empty chunk.
              // Hard break: take characters up to viewportWidth, or just the current char if it alone is too wide.
              if (
                numCodePointsInChunk === 0 &&
                charVisualWidth > viewportWidth
              ) {
                // Single character is wider than viewport, take it anyway
                currentChunk = char;
                numCodePointsInChunk = 1;
              }
            }
            break; // Break from inner loop to finalize this chunk
          }

          currentChunk += char;
          currentChunkVisualWidth += charVisualWidth;
          numCodePointsInChunk++;

          // Check for word break opportunity (space)
          if (char === ' ') {
            lastWordBreakPoint = i; // Store code point index of the space
            // Store the state *before* adding the space, if we decide to break here.
            numCodePointsAtLastWordBreak = numCodePointsInChunk - 1; // Chars *before* the space
          }
        }

        if (
          numCodePointsInChunk === 0 &&
          currentPosInLogLine < codePointsInLogLine.length
        ) {
          const firstChar = codePointsInLogLine[currentPosInLogLine];
          currentChunk = firstChar;
          numCodePointsInChunk = 1;
        }

        const logicalStartCol = transformedToLogMap[currentPosInLogLine] ?? 0;
        lineLogicalToVisualMap.push([lineVisualLines.length, logicalStartCol]);
        lineVisualToLogicalMap.push([logIndex, logicalStartCol]);
        lineVisualToTransformedMap.push(currentPosInLogLine);
        lineVisualLines.push(currentChunk);

        const logicalStartOfThisChunk = currentPosInLogLine;
        currentPosInLogLine += numCodePointsInChunk;

        if (
          logicalStartOfThisChunk + numCodePointsInChunk <
            codePointsInLogLine.length &&
          currentPosInLogLine < codePointsInLogLine.length &&
          codePointsInLogLine[currentPosInLogLine] === ' '
        ) {
          currentPosInLogLine++;
        }
      }
    }

    // Cache the result for this line
    lineLayoutCache.set(cacheKey, {
      visualLines: lineVisualLines,
      logicalToVisualMap: lineLogicalToVisualMap,
      visualToLogicalMap: lineVisualToLogicalMap,
      transformedToLogMap,
      visualToTransformedMap: lineVisualToTransformedMap,
    });

    const visualLineOffset = visualLines.length;
    visualLines.push(...lineVisualLines);
    lineLogicalToVisualMap.forEach(([relVisualIdx, logCol]) => {
      logicalToVisualMap[logIndex].push([
        visualLineOffset + relVisualIdx,
        logCol,
      ]);
    });
    lineVisualToLogicalMap.forEach(([, logCol]) => {
      visualToLogicalMap.push([logIndex, logCol]);
    });
    transformedToLogicalMaps[logIndex] = transformedToLogMap;
    visualToTransformedMap.push(...lineVisualToTransformedMap);
  });

  // If the entire logical text was empty, ensure there's one empty visual line.
  if (
    logicalLines.length === 0 ||
    (logicalLines.length === 1 && logicalLines[0] === '')
  ) {
    if (visualLines.length === 0) {
      visualLines.push('');
      if (!logicalToVisualMap[0]) logicalToVisualMap[0] = [];
      logicalToVisualMap[0].push([0, 0]);
      visualToLogicalMap.push([0, 0]);
      visualToTransformedMap.push(0);
    }
  }

  return {
    visualLines,
    logicalToVisualMap,
    visualToLogicalMap,
    transformedToLogicalMaps,
    visualToTransformedMap,
  };
}

// Calculates the visual cursor position based on a pre-calculated layout.
// This is a lightweight operation.
export function calculateVisualCursorFromLayout(
  layout: VisualLayout,
  logicalCursor: [number, number],
): [number, number] {
  const { logicalToVisualMap, visualLines, transformedToLogicalMaps } = layout;
  const [logicalRow, logicalCol] = logicalCursor;

  const segmentsForLogicalLine = logicalToVisualMap[logicalRow];

  if (!segmentsForLogicalLine || segmentsForLogicalLine.length === 0) {
    // This can happen for an empty document.
    return [0, 0];
  }

  // Find the segment where the logical column fits.
  // The segments are sorted by startColInLogical.
  let targetSegmentIndex = segmentsForLogicalLine.findIndex(
    ([, startColInLogical], index) => {
      const nextStartColInLogical =
        index + 1 < segmentsForLogicalLine.length
          ? segmentsForLogicalLine[index + 1][1]
          : Infinity;
      return (
        logicalCol >= startColInLogical && logicalCol < nextStartColInLogical
      );
    },
  );

  // If not found, it means the cursor is at the end of the logical line.
  if (targetSegmentIndex === -1) {
    if (logicalCol === 0) {
      targetSegmentIndex = 0;
    } else {
      targetSegmentIndex = segmentsForLogicalLine.length - 1;
    }
  }

  const [visualRow, startColInLogical] =
    segmentsForLogicalLine[targetSegmentIndex];

  // Find the coordinates in transformed space in order to conver to visual
  const transformedToLogicalMap = transformedToLogicalMaps[logicalRow] ?? [];
  let transformedCol = 0;
  for (let i = 0; i < transformedToLogicalMap.length; i++) {
    if (transformedToLogicalMap[i] > logicalCol) {
      transformedCol = Math.max(0, i - 1);
      break;
    }
    if (i === transformedToLogicalMap.length - 1) {
      transformedCol = transformedToLogicalMap.length - 1;
    }
  }
  let startColInTransformed = 0;
  while (
    startColInTransformed < transformedToLogicalMap.length &&
    transformedToLogicalMap[startColInTransformed] < startColInLogical
  ) {
    startColInTransformed++;
  }
  const clampedTransformedCol = Math.min(
    transformedCol,
    Math.max(0, transformedToLogicalMap.length - 1),
  );
  const visualCol = clampedTransformedCol - startColInTransformed;
  const clampedVisualCol = Math.min(
    Math.max(visualCol, 0),
    cpLen(visualLines[visualRow] ?? ''),
  );
  return [visualRow, clampedVisualCol];
}
