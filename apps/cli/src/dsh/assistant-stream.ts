/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent, AssistantStreamFrame } from '@deepseek-ai/dsh-agent';
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
import type { SessionEvent } from '@deepseek-ai/dsh-session';

type DurableAssistantStreamEvent = Extract<
  SessionEvent,
  { type: 'assistant/message' | 'assistant/attempt' }
>;

/** Whether a model stream chunk establishes first-token latency. */
export function isFirstTokenChunk(chunk: StreamChunk): boolean {
  return (
    (chunk.type === 'text-delta' && chunk.text !== '') ||
    (chunk.type === 'reasoning-delta' && chunk.text !== '') ||
    (chunk.type === 'tool-call-delta' &&
      (chunk.argumentsDelta !== '' || chunk.name !== undefined))
  );
}

/** Read the first visible token timestamp from a durable Assistant stream. */
export function assistantStreamFirstTokenTime(
  event: DurableAssistantStreamEvent,
): number | undefined {
  for (const record of event.data.stream) {
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

/** Subscribe to the Agent's canonical process-local Assistant stream. */
export function subscribeToAssistantStream(
  agent: Agent,
  listener: (frame: AssistantStreamFrame) => void,
): () => void {
  return agent.ctx.on('agent/assistant-stream', ({ frame }) => listener(frame));
}
