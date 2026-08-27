/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { Key } from './keys.js';
import { isConversationSwitchKey } from './keys.js';

function key(overrides: Partial<Key>): Key {
  return {
    name: '',
    shift: false,
    alt: false,
    ctrl: false,
    cmd: false,
    insertable: false,
    sequence: '',
    ...overrides,
  };
}

describe('isConversationSwitchKey', () => {
  it('matches the legacy Ctrl+/ control byte without modifier metadata', () => {
    expect(isConversationSwitchKey(key({ sequence: '\x1f' }))).toBe(true);
  });

  it.each(['/', '_'])('matches normalized Ctrl+%s', (name) => {
    expect(isConversationSwitchKey(key({ name, ctrl: true }))).toBe(true);
  });

  it('does not reserve an unmodified slash', () => {
    expect(
      isConversationSwitchKey(
        key({ name: '/', sequence: '/', insertable: true }),
      ),
    ).toBe(false);
  });
});
