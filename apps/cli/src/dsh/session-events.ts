/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SESSION_FORMAT_VERSION,
  SessionLogOffset,
  type Session,
  type SessionEvent,
} from '@deepseek-ai/dsh-session';

/** The sole compatibility boundary for Session observation across our endpoints. */
export function snapshotSessionEvents(
  session: Session,
): readonly SessionEvent[] {
  const compatible = session as unknown as {
    readonly events?: readonly SessionEvent[];
    snapshotEvents?: () => readonly SessionEvent[];
  };
  if (compatible.snapshotEvents !== undefined)
    return compatible.snapshotEvents();
  if (compatible.events !== undefined) return compatible.events;
  throw new Error(
    `DSH Session ${String(session.id)} does not expose an event snapshot API.`,
  );
}

/** DSH format 3 moved the exact inherited cut out of header metadata. */
export function forkSeedOptions(seed: readonly SessionEvent[]) {
  return Number(SESSION_FORMAT_VERSION) >= 3
    ? {
        seed,
        inheritedEventCount: SessionLogOffset(seed.length),
        meta: { isSeeded: true },
      }
    : { seed, meta: { seedLength: seed.length } };
}
