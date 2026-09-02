/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { ConversationTurnMetrics } from '../ui/conversation-runtime.js';
import {
  createInitialSessionTimingMetrics,
  type SessionTimingMetrics,
} from '../ui/session-metrics.js';

interface StepTiming {
  startedAt: number;
  firstTokenAt?: number;
  completed: boolean;
}

interface TurnTiming {
  startedAt: number;
  steps: Map<number, StepTiming>;
  decodeMs: number;
  decodeTokens: number;
  lastStep?: number;
}

export interface CompletedTurnTiming {
  messageId: string;
  metrics: ConversationTurnMetrics;
}

function eventTime(event: SessionEvent): number | undefined {
  const value = event.time;
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class SessionTimingProjector {
  readonly metrics: SessionTimingMetrics = createInitialSessionTimingMetrics();

  private readonly turns = new Map<number, TurnTiming>();
  private readonly closedTurns = new Set<number>();
  private readonly closedSteps = new Set<string>();
  private readonly toolStarts = new Map<string, { turn: number; at: number }>();

  project(event: SessionEvent): CompletedTurnTiming | undefined {
    const at = eventTime(event);
    if (at === undefined) return undefined;

    if (event.type === 'turn/start') {
      const { turn } = event.data;
      if (!this.turns.has(turn)) {
        this.turns.set(turn, {
          startedAt: at,
          steps: new Map(),
          decodeMs: 0,
          decodeTokens: 0,
        });
      }
      return undefined;
    }

    if (event.type === 'step/start') {
      const { turn, step } = event.data;
      const timing = this.turns.get(turn);
      if (timing === undefined) return undefined;
      if (!timing.steps.has(step)) {
        timing.steps.set(step, { startedAt: at, completed: false });
      }
      return undefined;
    }

    if (event.type === 'assistant/chunk') {
      const { chunk } = event.data;
      const isFirstToken =
        (chunk.type === 'text-delta' && chunk.text !== '') ||
        (chunk.type === 'reasoning-delta' && chunk.text !== '') ||
        (chunk.type === 'tool-call-delta' &&
          (chunk.argumentsDelta !== '' || chunk.name !== undefined));
      if (!isFirstToken) return undefined;
      const step = this.turns.get(event.data.turn)?.steps.get(event.data.step);
      if (step !== undefined && step.firstTokenAt === undefined) {
        step.firstTokenAt = at;
      }
      return undefined;
    }

    if (event.type === 'assistant/message') {
      const { turn, step } = event.data;
      const timing = this.turns.get(turn);
      const stepTiming = timing?.steps.get(step);
      if (
        timing === undefined ||
        stepTiming === undefined ||
        stepTiming.completed
      ) {
        return undefined;
      }
      stepTiming.completed = true;
      timing.lastStep = step;
      this.metrics.llmMs += Math.max(0, at - stepTiming.startedAt);
      if (stepTiming.firstTokenAt !== undefined) {
        this.metrics.ttftMs += Math.max(
          0,
          stepTiming.firstTokenAt - stepTiming.startedAt,
        );
        this.metrics.ttftSteps += 1;
        const outputTokens = event.data.usage?.outputTokens;
        const decodeMs = Math.max(0, at - stepTiming.firstTokenAt);
        if (
          outputTokens !== undefined &&
          Number.isFinite(outputTokens) &&
          outputTokens >= 0
        ) {
          this.metrics.decodeMs += decodeMs;
          this.metrics.decodeTokens += outputTokens;
          timing.decodeMs += decodeMs;
          timing.decodeTokens += outputTokens;
        }
      }
      return undefined;
    }

    if (event.type === 'tool/call') {
      const callId = String(event.data.callId);
      if (!this.toolStarts.has(callId)) {
        this.toolStarts.set(callId, { turn: event.data.turn, at });
      }
      return undefined;
    }

    if (event.type === 'tool/result') {
      const callId = String(event.data.message.source.callId);
      const started = this.toolStarts.get(callId);
      if (started !== undefined) {
        this.metrics.toolMs += Math.max(0, at - started.at);
        this.toolStarts.delete(callId);
      }
      return undefined;
    }

    if (event.type === 'step/end') {
      const { turn, step } = event.data;
      const key = `${String(turn)}:${String(step)}`;
      if (!this.closedSteps.has(key)) {
        this.closedSteps.add(key);
        this.metrics.steps += 1;
      }
      if (!this.closedTurns.has(turn)) {
        this.closedTurns.add(turn);
        this.metrics.turns += 1;
      }
      return undefined;
    }

    if (event.type !== 'turn/end') return undefined;
    for (const [callId, started] of this.toolStarts) {
      if (started.turn === event.data.turn) this.toolStarts.delete(callId);
    }
    const timing = this.turns.get(event.data.turn);
    if (timing === undefined) return undefined;
    this.turns.delete(event.data.turn);
    if (timing.lastStep === undefined) return undefined;
    const firstStep = [...timing.steps.entries()].sort(
      ([left], [right]) => left - right,
    )[0]?.[1];
    const ttftMs =
      firstStep?.firstTokenAt === undefined
        ? undefined
        : Math.max(0, firstStep.firstTokenAt - firstStep.startedAt);
    return {
      messageId: `assistant-${String(event.data.turn)}-${String(timing.lastStep)}`,
      metrics: {
        durationMs: Math.max(0, at - timing.startedAt),
        ...(ttftMs === undefined ? {} : { ttftMs }),
        ...(timing.decodeMs > 0 && timing.decodeTokens > 0
          ? {
              tokensPerSecond: timing.decodeTokens / (timing.decodeMs / 1_000),
            }
          : {}),
      },
    };
  }
}
