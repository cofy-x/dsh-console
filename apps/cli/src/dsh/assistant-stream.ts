/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent, AssistantStreamFrame } from '@deepseek-ai/dsh-agent';

/** Subscribe to the Agent's canonical process-local Assistant stream. */
export function subscribeToAssistantStream(
  agent: Agent,
  listener: (frame: AssistantStreamFrame) => void,
): () => void {
  return agent.ctx.on('agent/assistant-stream', ({ frame }) => listener(frame));
}
