/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PermissionOptionView {
  value: string;
  name: string;
  description?: string;
  requiresConfirmation: boolean;
}
export interface PermissionSelectionSnapshot {
  available: boolean;
  currentValue?: string;
  options: readonly PermissionOptionView[];
  busy: boolean;
}

export interface PermissionSelectionRuntime {
  getSnapshot(): PermissionSelectionSnapshot;
  subscribe(listener: () => void): () => void;
  setPermission(value: string, signal?: AbortSignal): Promise<PermissionOptionView>;
}
