/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import os from 'node:os';
import * as crypto from 'node:crypto';

export const DSH_CONSOLE_DIR = '.dsh-console';

/**
 * Special characters that need to be escaped in file paths for shell compatibility.
 * Includes: spaces, parentheses, brackets, braces, semicolons, ampersands, pipes,
 * asterisks, question marks, dollar signs, backticks, quotes, hash, and other shell metacharacters.
 */
const SHELL_SPECIAL_CHARS = /[ \t()[\]{};|*?$`'"#&<>!~]/;

/**
 * Returns the home directory.
 * If DSH_CONSOLE_HOME environment variable is set, it returns its value.
 * Otherwise, it returns the user's home directory.
 */
export function homedir(): string {
  const envHome = process.env['DSH_CONSOLE_HOME'];
  if (envHome) {
    return envHome;
  }
  return os.homedir();
}

/**
 * Replaces the home directory with a tilde.
 * @param path - The path to tildeify.
 * @returns The tildeified path.
 */
export function tildeifyPath(path: string): string {
  const homeDir = homedir();
  if (path.startsWith(homeDir)) {
    return path.replace(homeDir, '~');
  }
  return path;
}

/**
 * Shortens a path string if it exceeds maxLen, prioritizing the start and end segments.
 * Example: /path/to/a/very/long/file.txt -> /path/.../long/file.txt
 */
export function shortenPath(filePath: string, maxLen: number = 35): string {
  if (filePath.length <= maxLen) {
    return filePath;
  }

  const simpleTruncate = () => {
    const keepLen = Math.floor((maxLen - 3) / 2);
    if (keepLen <= 0) {
      return filePath.substring(0, maxLen - 3) + '...';
    }
    const start = filePath.substring(0, keepLen);
    const end = filePath.substring(filePath.length - keepLen);
    return `${start}...${end}`;
  };

  type TruncateMode = 'start' | 'end' | 'center';

  const truncateComponent = (
    component: string,
    targetLength: number,
    mode: TruncateMode,
  ): string => {
    if (component.length <= targetLength) {
      return component;
    }

    if (targetLength <= 0) {
      return '';
    }

    if (targetLength <= 3) {
      if (mode === 'end') {
        return component.slice(-targetLength);
      }
      return component.slice(0, targetLength);
    }

    if (mode === 'start') {
      return `${component.slice(0, targetLength - 3)}...`;
    }

    if (mode === 'end') {
      return `...${component.slice(component.length - (targetLength - 3))}`;
    }

    const front = Math.ceil((targetLength - 3) / 2);
    const back = targetLength - 3 - front;
    return `${component.slice(0, front)}...${component.slice(
      component.length - back,
    )}`;
  };

  const parsedPath = path.parse(filePath);
  const root = parsedPath.root;
  const separator = path.sep;

  // Get segments of the path *after* the root
  const relativePath = filePath.substring(root.length);
  const segments = relativePath.split(separator).filter((s) => s !== ''); // Filter out empty segments

  // Handle cases with no segments after root (e.g., "/", "C:\") or only one segment
  if (segments.length <= 1) {
    // Fall back to simple start/end truncation for very short paths or single segments
    return simpleTruncate();
  }

  const firstDir = segments[0];
  const lastSegment = segments[segments.length - 1];
  const startComponent = root + firstDir;

  const endPartSegments = [lastSegment];
  let endPartLength = lastSegment.length;

  // Iterate backwards through the middle segments
  for (let i = segments.length - 2; i > 0; i--) {
    const segment = segments[i];
    const newLength =
      startComponent.length +
      separator.length +
      3 + // for "..."
      separator.length +
      endPartLength +
      separator.length +
      segment.length;

    if (newLength <= maxLen) {
      endPartSegments.unshift(segment);
      endPartLength += separator.length + segment.length;
    } else {
      break;
    }
  }

  const components = [firstDir, ...endPartSegments];
  const componentModes: TruncateMode[] = components.map((_, index) => {
    if (index === 0) {
      return 'start';
    }
    if (index === components.length - 1) {
      return 'end';
    }
    return 'center';
  });

  const separatorsCount = endPartSegments.length + 1;
  const fixedLen = root.length + separatorsCount * separator.length + 3; // ellipsis length
  const availableForComponents = maxLen - fixedLen;

  const trailingFallback = () => {
    const ellipsisTail = `...${separator}${lastSegment}`;
    if (ellipsisTail.length <= maxLen) {
      return ellipsisTail;
    }

    if (root) {
      const rootEllipsisTail = `${root}...${separator}${lastSegment}`;
      if (rootEllipsisTail.length <= maxLen) {
        return rootEllipsisTail;
      }
    }

    if (root && `${root}${lastSegment}`.length <= maxLen) {
      return `${root}${lastSegment}`;
    }

    if (lastSegment.length <= maxLen) {
      return lastSegment;
    }

    // As a final resort (e.g., last segment itself exceeds maxLen), fall back to simple truncation.
    return simpleTruncate();
  };

  if (availableForComponents <= 0) {
    return trailingFallback();
  }

  const minLengths = components.map((component, index) => {
    if (index === 0) {
      return Math.min(component.length, 1);
    }
    if (index === components.length - 1) {
      return component.length; // Never truncate the last segment when possible.
    }
    return Math.min(component.length, 1);
  });

  const minTotal = minLengths.reduce((sum, len) => sum + len, 0);
  if (availableForComponents < minTotal) {
    return trailingFallback();
  }

  const budgets = components.map((component) => component.length);
  let currentTotal = budgets.reduce((sum, len) => sum + len, 0);

  const pickIndexToReduce = () => {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < budgets.length; i++) {
      if (budgets[i] <= minLengths[i]) {
        continue;
      }
      const isLast = i === budgets.length - 1;
      const score = (isLast ? 0 : 1_000_000) + budgets[i];
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return bestIndex;
  };

  while (currentTotal > availableForComponents) {
    const index = pickIndexToReduce();
    if (index === -1) {
      return trailingFallback();
    }
    budgets[index]--;
    currentTotal--;
  }

  const truncatedComponents = components.map((component, index) =>
    truncateComponent(component, budgets[index], componentModes[index]),
  );

  const truncatedFirst = truncatedComponents[0];
  const truncatedEnd = truncatedComponents.slice(1).join(separator);
  const result = `${root}${truncatedFirst}${separator}...${separator}${truncatedEnd}`;

  if (result.length > maxLen) {
    return trailingFallback();
  }

  return result;
}

/**
 * Escapes special characters in a file path like macOS terminal does.
 * Escapes: spaces, parentheses, brackets, braces, semicolons, ampersands, pipes,
 * asterisks, question marks, dollar signs, backticks, quotes, hash, and other shell metacharacters.
 */
export function escapePath(filePath: string): string {
  let result = '';
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath[i];

    // Count consecutive backslashes before this character
    let backslashCount = 0;
    for (let j = i - 1; j >= 0 && filePath[j] === '\\'; j--) {
      backslashCount++;
    }

    // Character is already escaped if there's an odd number of backslashes before it
    const isAlreadyEscaped = backslashCount % 2 === 1;

    // Only escape if not already escaped
    if (!isAlreadyEscaped && SHELL_SPECIAL_CHARS.test(char)) {
      result += '\\' + char;
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Unescapes special characters in a file path.
 * Removes backslash escaping from shell metacharacters.
 */
export function unescapePath(filePath: string): string {
  return filePath.replace(
    new RegExp(`\\\\([${SHELL_SPECIAL_CHARS.source.slice(1, -1)}])`, 'g'),
    '$1',
  );
}

/**
 * Generates a unique, safe hash for a file path.
 */
export function getFilePathHash(filePath: string): string {
  let normalizedPath = path.resolve(filePath);

  // Windows and macOS are generally case-insensitive
  if (os.platform() === 'win32' || os.platform() === 'darwin') {
    normalizedPath = normalizedPath.toLowerCase();
  }

  return crypto
    .createHash('sha256')
    .update(normalizedPath)
    .digest('hex')
    .substring(0, 12);
}
