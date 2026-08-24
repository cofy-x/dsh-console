/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Key } from './keys.js';

export type KeyDebugMetadata =
  | {
      kind: 'text-input' | 'paste';
      length: number;
    }
  | {
      kind: 'key';
      name: string;
      ctrl: boolean;
      cmd: boolean;
      alt: boolean;
      shift: boolean;
    };

/**
 * Project a terminal key into privacy-safe diagnostic metadata.
 *
 * Printable input and paste payloads never expose their name or sequence.
 */
export function keyDebugMetadata(key: Key): KeyDebugMetadata {
  if (key.name === 'paste') {
    return {
      kind: 'paste',
      length: Array.from(key.sequence).length,
    };
  }
  if (key.insertable) {
    return {
      kind: 'text-input',
      length: Array.from(key.sequence).length,
    };
  }
  return {
    kind: 'key',
    name: key.name || 'unknown',
    ctrl: key.ctrl,
    cmd: key.cmd,
    alt: key.alt,
    shift: key.shift,
  };
}
