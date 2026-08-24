/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PromptTextPart {
  type: 'text';
  text: string;
}

/** Local image input awaiting admission by the DSH attachment service. */
export interface PromptImageSourcePart {
  type: 'image-source';
  source: {
    kind: 'workspace-file' | 'clipboard-file';
    path: string;
  };
  displayName: string;
  declaredMediaType: string;
}

export type PromptInputPart = PromptTextPart | PromptImageSourcePart;

export interface PromptInputRequest {
  text: string;
  workspaceRoots: readonly string[];
  clipboardImageRoots: readonly string[];
  signal: AbortSignal;
}

export interface PreparedPromptInput {
  content: readonly PromptInputPart[];
  displayContent: readonly PromptInputPart[];
}

export interface PromptInputRuntime {
  prepare(request: PromptInputRequest): Promise<PreparedPromptInput>;
  dispose(): Promise<void>;
}
