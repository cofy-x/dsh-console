/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { SessionTimingProjector } from './session-timing-projector.js';

function event(value: unknown): SessionEvent {
  return value as SessionEvent;
}

describe('SessionTimingProjector', () => {
  it('derives per-turn and aggregate metrics from canonical events', () => {
    const projector = new SessionTimingProjector();
    const events = [
      event({ type: 'turn/start', time: 1_000, data: { turn: 1 } }),
      event({ type: 'step/start', time: 1_100, data: { turn: 1, step: 1 } }),
      event({
        type: 'assistant/chunk',
        time: 1_500,
        data: {
          turn: 1,
          step: 1,
          chunk: { type: 'text-delta', index: 0, text: 'Hello' },
        },
      }),
      event({
        type: 'assistant/message',
        time: 2_500,
        data: {
          turn: 1,
          step: 1,
          message: { id: 'message-1', content: [] },
          usage: { inputTokens: 10, outputTokens: 100 },
        },
      }),
      event({
        type: 'tool/call',
        time: 2_600,
        data: { turn: 1, step: 1, callId: 'call-1', name: 'read' },
      }),
      event({
        type: 'tool/result',
        time: 2_850,
        data: {
          turn: 1,
          step: 1,
          message: { source: { callId: 'call-1' } },
        },
      }),
      event({
        type: 'step/end',
        time: 2_900,
        data: { turn: 1, step: 1 },
      }),
      event({
        type: 'turn/end',
        time: 3_000,
        data: { turn: 1, reason: { kind: 'completed' } },
      }),
    ];

    let completed;
    for (const current of events) completed = projector.project(current);

    expect(completed).toEqual({
      messageId: 'assistant-1-1',
      metrics: { durationMs: 2_000, ttftMs: 400, tokensPerSecond: 100 },
    });
    expect(projector.metrics).toEqual({
      turns: 1,
      steps: 1,
      llmMs: 1_400,
      toolMs: 250,
      ttftMs: 400,
      ttftSteps: 1,
      decodeMs: 1_000,
      decodeTokens: 100,
    });
  });

  it('omits unavailable throughput instead of reporting a false zero', () => {
    const projector = new SessionTimingProjector();
    projector.project(
      event({ type: 'turn/start', time: 0, data: { turn: 2 } }),
    );
    projector.project(
      event({
        type: 'step/start',
        time: 100,
        data: { turn: 2, step: 1 },
      }),
    );
    projector.project(
      event({
        type: 'assistant/message',
        time: 500,
        data: { turn: 2, step: 1, message: { id: 'message-2', content: [] } },
      }),
    );
    projector.project(
      event({
        type: 'step/end',
        time: 550,
        data: { turn: 2, step: 1 },
      }),
    );
    const completed = projector.project(
      event({
        type: 'turn/end',
        time: 600,
        data: { turn: 2, reason: { kind: 'completed' } },
      }),
    );

    expect(completed).toEqual({
      messageId: 'assistant-2-1',
      metrics: { durationMs: 600 },
    });
  });

  it('treats tool-call output as a first token and counts only closed steps', () => {
    const projector = new SessionTimingProjector();
    projector.project(
      event({ type: 'turn/start', time: 0, data: { turn: 3 } }),
    );
    projector.project(
      event({
        type: 'step/start',
        time: 100,
        data: { turn: 3, step: 1 },
      }),
    );
    projector.project(
      event({
        type: 'assistant/chunk',
        time: 300,
        data: {
          turn: 3,
          step: 1,
          chunk: {
            type: 'tool-call-delta',
            index: 0,
            callId: 'call-3',
            argumentsDelta: '{',
          },
        },
      }),
    );
    projector.project(
      event({
        type: 'assistant/message',
        time: 500,
        data: {
          turn: 3,
          step: 1,
          message: { id: 'message-3', content: [] },
          usage: { inputTokens: 5, outputTokens: 0 },
        },
      }),
    );

    expect(projector.metrics).toMatchObject({
      turns: 0,
      steps: 0,
      ttftMs: 200,
      ttftSteps: 1,
      decodeMs: 200,
      decodeTokens: 0,
    });
    projector.project(
      event({
        type: 'step/end',
        time: 550,
        data: { turn: 3, step: 1 },
      }),
    );
    expect(projector.metrics).toMatchObject({ turns: 1, steps: 1 });
  });
});
