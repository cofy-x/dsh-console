/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Key } from './keys.js';
import { keyDebugMetadata } from './key-debug-metadata.js';

function key(overrides: Partial<Key>): Key {
  return {
    name: '',
    sequence: '',
    insertable: false,
    shift: false,
    alt: false,
    ctrl: false,
    cmd: false,
    ...overrides,
  };
}

describe('keyDebugMetadata', () => {
  it('redacts printable characters', () => {
    const metadata = keyDebugMetadata(
      key({ name: 's', sequence: 's', insertable: true }),
    );

    expect(metadata).toEqual({ kind: 'text-input', length: 1 });
    expect(JSON.stringify(metadata)).not.toContain('s');
  });

  it('redacts paste content while preserving its size', () => {
    const metadata = keyDebugMetadata(
      key({
        name: 'paste',
        sequence: 'provider-secret-value',
        insertable: true,
      }),
    );

    expect(metadata).toEqual({ kind: 'paste', length: 21 });
    expect(JSON.stringify(metadata)).not.toContain('provider-secret-value');
  });

  it('keeps non-printable key diagnostics', () => {
    expect(
      keyDebugMetadata(
        key({ name: 'return', sequence: '\r', ctrl: true, shift: true }),
      ),
    ).toEqual({
      kind: 'key',
      name: 'return',
      ctrl: true,
      cmd: false,
      alt: false,
      shift: true,
    });
  });
});
