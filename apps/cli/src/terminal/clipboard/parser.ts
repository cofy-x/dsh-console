/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { escapePath, unescapePath } from '@cofy-x/dsh-console-core';

/** Matches strings that start with a path prefix (/, ~, ., Windows drive letter, or UNC path) */
const PATH_PREFIX_PATTERN = /^([/~.]|[a-zA-Z]:|\\\\)/;

/**
 * Splits text into individual path segments, respecting escaped spaces.
 * Unescaped spaces act as separators between paths, while "\ " is preserved
 * as part of a filename.
 *
 * Example: "/img1.png /path/my\ image.png" → ["/img1.png", "/path/my\ image.png"]
 *
 * @param text The text to split
 * @returns Array of path segments (still escaped)
 */
export function splitEscapedPaths(text: string): string[] {
  const paths: string[] = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === '\\' && i + 1 < text.length && text[i + 1] === ' ') {
      // Escaped space - part of filename, preserve the escape sequence
      current += '\\ ';
      i += 2;
    } else if (char === ' ') {
      // Unescaped space - path separator
      if (current.trim()) {
        paths.push(current.trim());
      }
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Don't forget the last segment
  if (current.trim()) {
    paths.push(current.trim());
  }

  return paths;
}

/**
 * Processes pasted text containing file paths, adding @ prefix to valid paths.
 * Handles both single and multiple space-separated paths.
 *
 * @param text The pasted text (potentially space-separated paths)
 * @param isValidPath Function to validate if a path exists/is valid
 * @returns Processed string with @ prefixes on valid paths, or null if no valid paths
 */
export function parsePastedPaths(
  text: string,
  isValidPath: (path: string) => boolean,
): string | null {
  // First, check if the entire text is a single valid path
  if (PATH_PREFIX_PATTERN.test(text) && isValidPath(text)) {
    return `@${escapePath(text)} `;
  }

  // Otherwise, try splitting on unescaped spaces
  const segments = splitEscapedPaths(text);
  if (segments.length === 0) {
    return null;
  }

  let anyValidPath = false;
  const processedPaths = segments.map((segment) => {
    // Quick rejection: skip segments that can't be paths
    if (!PATH_PREFIX_PATTERN.test(segment)) {
      return segment;
    }
    const unescaped = unescapePath(segment);
    if (isValidPath(unescaped)) {
      anyValidPath = true;
      return `@${segment}`;
    }
    return segment;
  });

  return anyValidPath ? processedPaths.join(' ') + ' ' : null;
}
