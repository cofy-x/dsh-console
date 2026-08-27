/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConversationSnapshot } from './conversation-runtime.js';

/** Read-only canonical conversation view for one DSH subagent Session. */
export interface SubagentTranscriptRuntime {
  getSnapshot(): ConversationSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
