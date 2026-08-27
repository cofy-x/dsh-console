/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session';

export const SIDE_SESSION_PREFIX = 'dsh-console-side-';

export function completedTurnSeed(
  events: readonly SessionEvent[],
): readonly SessionEvent[] {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === 'turn/end') return events.slice(0, index + 1);
  }
  return [];
}

export function pendingUserText(
  events: readonly SessionEvent[],
  seedLength: number,
): string {
  for (let index = events.length - 1; index >= seedLength; index -= 1) {
    const event = events[index];
    if (event.type !== 'user/message') continue;
    return event.data.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim();
  }
  return '';
}

export function firstSidePrompt(question: string, pendingRequest: string): string {
  return [
    'You are a Side conversation branching from the main conversation context above.',
    'Help with the side discussion without continuing or modifying the main task.',
    'No tools are available in this Side conversation.',
    ...(pendingRequest
      ? ['The main Agent is currently working on this request:', pendingRequest]
      : []),
    'Side question:',
    question,
  ].join('\n\n');
}
