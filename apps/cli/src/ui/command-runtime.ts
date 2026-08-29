/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DshCommandDescriptorView {
  name: string;
  description: string;
  inputHint?: string;
}

export interface DshCommandSnapshot {
  commands: readonly DshCommandDescriptorView[];
}

export interface DshCommandResultView {
  kind: 'success' | 'error';
  text?: string;
}

export interface DshCommandRuntime {
  getSnapshot(): DshCommandSnapshot;
  subscribe(listener: () => void): () => void;
  prepare(signal: AbortSignal): Promise<void>;
  execute(line: string, signal: AbortSignal): Promise<DshCommandResultView>;
}
