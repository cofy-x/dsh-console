/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  ApprovalOutcome,
  ApprovalRequest,
} from '@deepseek-ai/dsh-user-approval';
import type {
  ApprovalRequestView,
  ApprovalResponse,
  ApprovalRuntime,
  ApprovalSnapshot,
} from '../ui/approval-runtime.js';
import { sanitizeForDisplay } from '../text/processing.js';

type ApprovalListener = (
  request: ApprovalRequest,
  next: () => Promise<ApprovalOutcome>,
) => Promise<ApprovalOutcome>;

interface PendingApproval {
  view: ApprovalRequestView;
  resolve: (outcome: ApprovalOutcome) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

export class DshApprovalRuntime implements ApprovalRuntime {
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<string, PendingApproval>();
  private snapshot: ApprovalSnapshot = Object.freeze({ pending: [] });
  private sequence = 0;
  private readonly off: () => void;
  private disposed = false;

  constructor(
    register: (listener: ApprovalListener) => () => void,
    private readonly ownsAgent: (agent: Agent) => boolean,
  ) {
    this.off = register((request, next) => this.request(request, next));
  }

  getSnapshot = (): ApprovalSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  respond = (requestId: string, response: ApprovalResponse): void => {
    this.settle(requestId, response);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.off();
    for (const id of [...this.pending.keys()]) this.settle(id, 'unavailable');
    this.listeners.clear();
  }

  private request(
    request: ApprovalRequest,
    next: () => Promise<ApprovalOutcome>,
  ): Promise<ApprovalOutcome> {
    if (!this.ownsAgent(request.agent)) return next();
    if (this.disposed) return Promise.resolve('unavailable');
    if (request.signal?.aborted) return Promise.resolve('cancelled');

    const id = `dsh-approval-${++this.sequence}`;
    return new Promise<ApprovalOutcome>((resolve) => {
      const toolName = sanitizeForDisplay(request.toolName, 160) || 'Tool';
      const callId =
        request.callId === undefined
          ? undefined
          : sanitizeForDisplay(String(request.callId), 160);
      const reason =
        request.reason === undefined
          ? undefined
          : sanitizeForDisplay(request.reason, 2000);
      const pending: PendingApproval = {
        view: Object.freeze({
          id,
          toolName,
          ...(callId ? { callId } : {}),
          ...(reason ? { reason } : {}),
        }),
        resolve,
        signal: request.signal,
      };
      if (request.signal !== undefined) {
        pending.onAbort = () => this.settle(id, 'cancelled');
        request.signal.addEventListener('abort', pending.onAbort, {
          once: true,
        });
      }
      this.pending.set(id, pending);
      this.publish();
    });
  }

  private settle(id: string, outcome: ApprovalOutcome): void {
    const pending = this.pending.get(id);
    if (pending === undefined) return;
    this.pending.delete(id);
    if (pending.signal !== undefined && pending.onAbort !== undefined) {
      pending.signal.removeEventListener('abort', pending.onAbort);
    }
    this.publish();
    pending.resolve(outcome);
  }

  private publish(): void {
    this.snapshot = Object.freeze({
      pending: Object.freeze(
        [...this.pending.values()].map((entry) => entry.view),
      ),
    });
    for (const listener of this.listeners) listener();
  }
}
