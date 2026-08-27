/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session';
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query';
import type { SubagentTranscriptRuntime } from '../ui/subagent-transcript-runtime.js';
import type { DshToolPresenter } from './projector.js';
import { DshSessionProjector } from './projector.js';

type SessionEventSubscriber = (
  sessionId: SessionId,
  listener: (event: SessionEvent) => void,
) => () => void;

function cancelled(): DOMException {
  return new DOMException('Subagent transcript loading was cancelled.', 'AbortError');
}

export class DshSubagentTranscriptRuntime implements SubagentTranscriptRuntime {
  static async create(
    query: Pick<SessionQueryEngine, 'readSession'>,
    sessionId: SessionId,
    presenter: DshToolPresenter,
    subscribeToSession: SessionEventSubscriber,
    signal?: AbortSignal,
  ): Promise<DshSubagentTranscriptRuntime> {
    signal?.throwIfAborted();
    const projector = new DshSessionProjector(
      String(sessionId),
      'subagent',
      presenter,
    );
    const buffered: SessionEvent[] = [];
    let replaying = true;
    const off = subscribeToSession(sessionId, (event) => {
      if (replaying) buffered.push(event);
      else projector.project(event);
    });
    try {
      const log = await query.readSession(sessionId);
      if (signal?.aborted) throw cancelled();
      projector.replay(log.events);
      const replayedSeq = log.events.at(-1)?.seq ?? -1;
      for (const event of buffered) {
        if (event.seq > replayedSeq) projector.project(event);
      }
      replaying = false;
      return new DshSubagentTranscriptRuntime(projector, off);
    } catch (error) {
      off();
      throw error;
    }
  }

  private disposed = false;

  private constructor(
    private readonly projector: DshSessionProjector,
    private readonly off: () => void,
  ) {}

  getSnapshot = () => this.projector.getSnapshot();

  subscribe = (listener: () => void): (() => void) =>
    this.projector.subscribe(listener);

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.off();
  }
}
