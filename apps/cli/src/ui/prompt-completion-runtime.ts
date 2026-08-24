/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PromptCompletionRuntime {
  complete(text: string, signal: AbortSignal): Promise<string | null>;
  dispose(): Promise<void>;
}
