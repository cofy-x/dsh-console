/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ImageMediaType } from '@deepseek-ai/dsh-attachment';

export interface DshCommandDescriptorView {
  name: string;
  description: string;
  inputHint?: string;
  acceptsAttachments: boolean;
}

export interface DshCommandImageAttachmentInput {
  sourceKind: 'workspace-file' | 'clipboard-file';
  path: string;
  mediaType: ImageMediaType;
  name: string;
}

export interface DshCommandSnapshot {
  commands: readonly DshCommandDescriptorView[];
}

export interface DshCommandResultView {
  kind: 'success' | 'error';
  text?: string;
  sourceEventSeq?: number;
}

export interface DshCommandRuntime {
  getSnapshot(): DshCommandSnapshot;
  subscribe(listener: () => void): () => void;
  prepare(signal: AbortSignal): Promise<void>;
  attachmentPolicy?(line: string): boolean | undefined;
  execute(
    line: string,
    attachments: readonly DshCommandImageAttachmentInput[],
    signal: AbortSignal,
  ): Promise<DshCommandResultView>;
}
