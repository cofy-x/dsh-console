/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SessionLogOffset,
  type Session,
  type SessionEvent,
} from '@deepseek-ai/dsh-session';

/**
 * The sole boundary for existing synchronous Session observation.
 *
 * DSH 0.1.6-alpha.1 deprecates snapshotEvents() for new consumers while
 * explicitly allowing existing readers to remain until a stable replacement
 * is published. Keep every remaining use behind this adapter so that future
 * migration follows one public DSH contract rather than per-feature fallbacks.
 */
export function snapshotSessionEvents(
  session: Session,
): readonly SessionEvent[] {
  return session.snapshotEvents();
}

/** Build a completed-turn seed; DSH owns fork markers and format migration. */
export function forkSeedOptions(seed: readonly SessionEvent[]) {
  return {
    seed,
    inheritedEventCount: SessionLogOffset(seed.length),
    meta: { isSeeded: true },
  };
}
