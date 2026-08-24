/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type ApprovalResponse = 'allowed-once' | 'rejected' | 'cancelled';

export interface ApprovalRequestView {
  id: string;
  toolName: string;
  callId?: string;
  reason?: string;
}

export interface ApprovalSnapshot {
  pending: readonly ApprovalRequestView[];
}

export interface ApprovalRuntime {
  getSnapshot(): ApprovalSnapshot;
  subscribe(listener: () => void): () => void;
  respond(requestId: string, response: ApprovalResponse): void;
}

const EMPTY_SNAPSHOT: ApprovalSnapshot = Object.freeze({ pending: [] });

export const NO_APPROVAL_RUNTIME: ApprovalRuntime = {
  getSnapshot: () => EMPTY_SNAPSHOT,
  subscribe: () => () => undefined,
  respond: () => undefined,
};
