/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { completedTurnSeed, firstSidePrompt, pendingUserText } from './side-conversation.js';

const event = (value: unknown): SessionEvent => value as SessionEvent;

describe('Side conversation context', () => {
  it('seeds only complete Main turns and describes the pending request', () => {
    const completed = event({ type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
    const pending = event({
      type: 'user/message',
      data: { turn: 2, content: [{ type: 'text', text: 'main work' }], source: { kind: 'user' } },
    });
    const events = [completed, pending];
    const seed = completedTurnSeed(events);
    expect(seed).toEqual([completed]);
    expect(pendingUserText(events, seed.length)).toBe('main work');
    expect(firstSidePrompt('why?', 'main work')).toContain('Side question:\n\nwhy?');
  });
});
