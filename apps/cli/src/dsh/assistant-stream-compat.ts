/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
import type { SessionEvent } from '@deepseek-ai/dsh-session';

/** Legacy pre-v2 Session event retained only at the DSH compatibility boundary. */
export interface LegacyAssistantChunkEvent {
  readonly type: 'assistant/chunk';
  readonly time: number | string;
  readonly data: {
    readonly turn: number;
    readonly step: number;
    readonly chunk: StreamChunk;
  };
}

/** Process-local Assistant stream introduced with DSH Session format v2. */
export type AssistantStreamFrameCompat =
  | {
      readonly type: 'start';
      readonly attemptId: string;
      readonly revision: number;
      readonly turn: number;
      readonly step: number;
    }
  | {
      readonly type: 'chunk';
      readonly attemptId: string;
      readonly revision: number;
      readonly index: number;
      readonly time: number;
      readonly chunk: StreamChunk;
    }
  | {
      readonly type: 'end';
      readonly attemptId: string;
      readonly revision: number;
      readonly index: number;
      readonly outcome:
        | {
            readonly kind: 'committed';
            readonly eventType: 'assistant/message' | 'assistant/attempt';
            readonly seq: number;
          }
        | { readonly kind: 'abandoned' };
    };

type CompactAssistantStreamRecord =
  | {
      readonly type: 'text-chunks' | 'reasoning-chunks';
      readonly time0: number;
      readonly dt: readonly number[];
      readonly texts: readonly string[];
    }
  | {
      readonly type: 'tool-call-chunks';
      readonly time0: number;
      readonly dt: readonly number[];
      readonly name?: string;
      readonly args: readonly string[];
    }
  | {
      readonly type: 'chunk';
      readonly time: number;
      readonly chunk: StreamChunk;
    };

/** V2 log-only attempt event absent from the declared minimum DSH types. */
export interface V2AssistantAttemptEvent {
  readonly type: 'assistant/attempt';
  readonly time: number | string;
  readonly data: {
    readonly turn: number;
    readonly step: number;
    readonly stream: readonly CompactAssistantStreamRecord[];
  };
}

/** Session input accepted across the declared minimum and maximum DSH endpoints. */
export type CompatibleSessionEvent =
  | SessionEvent
  | LegacyAssistantChunkEvent
  | V2AssistantAttemptEvent;

/** Narrow a Session event to the legacy transient chunk representation. */
export function isLegacyAssistantChunkEvent(
  event: CompatibleSessionEvent,
): event is LegacyAssistantChunkEvent {
  return (event as { readonly type: string }).type === 'assistant/chunk';
}

/** Whether a model stream chunk establishes first-token latency. */
export function isFirstTokenChunk(chunk: StreamChunk): boolean {
  return (
    (chunk.type === 'text-delta' && chunk.text !== '') ||
    (chunk.type === 'reasoning-delta' && chunk.text !== '') ||
    (chunk.type === 'tool-call-delta' &&
      (chunk.argumentsDelta !== '' || chunk.name !== undefined))
  );
}

/** Read the first visible token timestamp from a v2 durable Assistant stream. */
export function assistantStreamFirstTokenTime(event: {
  readonly data: object;
}): number | undefined {
  const { stream } = event.data as {
    readonly stream?: readonly CompactAssistantStreamRecord[];
  };
  if (stream === undefined) return undefined;

  for (const record of stream) {
    if (record.type === 'chunk') {
      if (isFirstTokenChunk(record.chunk)) return record.time;
      continue;
    }
    const members =
      record.type === 'tool-call-chunks' ? record.args : record.texts;
    let time = record.time0;
    for (let index = 0; index < members.length; index += 1) {
      if (index > 0) time += record.dt[index - 1] ?? 0;
      if (
        members[index] !== '' ||
        (record.type === 'tool-call-chunks' && record.name !== undefined)
      ) {
        return time;
      }
    }
  }
  return undefined;
}

/** Subscribe to v2 live Assistant frames without requiring that event in the minimum DSH types. */
export function subscribeToAssistantStream(
  agent: Agent,
  listener: (frame: AssistantStreamFrameCompat) => void,
): () => void {
  const on = agent.ctx.on as unknown as (
    event: 'agent/assistant-stream',
    callback: (payload: { readonly frame: AssistantStreamFrameCompat }) => void,
  ) => () => void;
  return on('agent/assistant-stream', ({ frame }) => listener(frame));
}
