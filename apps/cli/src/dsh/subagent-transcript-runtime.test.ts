/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session';
import { DshSubagentTranscriptRuntime } from './subagent-transcript-runtime.js';

describe('DshSubagentTranscriptRuntime', () => {
  it('replays canonical history and appends later live events', async () => {
    let onEvent: ((event: SessionEvent) => void) | undefined;
    const runtime = await DshSubagentTranscriptRuntime.create(
      {
        readSession: vi.fn(async () => ({
          session: {},
          events: [
            {
              seq: 0,
              time: 1,
              type: 'user/message',
              surfaceOp: 'append',
              data: {
                id: 'user-1',
                role: 'user',
                content: [{ type: 'text', text: 'inspect' }],
                source: { kind: 'user' },
              },
            },
          ],
        })),
      } as never,
      SessionId('child-1'),
      { presentCall: vi.fn(), presentResult: vi.fn() },
      (_sessionId, listener) => {
        onEvent = listener;
        return vi.fn();
      },
    );

    onEvent?.({
      seq: 1,
      time: 2,
      type: 'assistant/message',
      surfaceOp: 'append',
      data: {
        turn: 1,
        step: 1,
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'done' }],
          source: { kind: 'model', provider: 'test', model: 'test' },
        },
      },
    } as SessionEvent);

    expect(runtime.getSnapshot().messages).toHaveLength(2);
    runtime.dispose();
  });
});
