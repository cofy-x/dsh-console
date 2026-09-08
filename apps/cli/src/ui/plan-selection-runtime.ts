/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PlanSelectionSnapshot {
  available: boolean;
  active: boolean;
  pending: boolean;
  requestedActive: boolean;
  busy: boolean;
}

export interface PlanSelectionRuntime {
  getSnapshot(): PlanSelectionSnapshot;
  subscribe(listener: () => void): () => void;
  setActive(active: boolean, signal?: AbortSignal): Promise<void>;
}
