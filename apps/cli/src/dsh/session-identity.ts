/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionHeader } from '@deepseek-ai/dsh-session';

export const CONSOLE_FORK_PREFIX = 'dsh-console-fork-';

export function isConsoleSessionId(id: string): boolean {
  return (
    !/[\p{Cc}\p{Cf}]/u.test(id) &&
    id.startsWith('dsh-console-') &&
    !id.startsWith('dsh-console-completion-') &&
    !id.startsWith('dsh-console-side-')
  );
}

/** Fork lineage is not agent delegation. Do not expose arbitrary children. */
export function isConsoleSessionHeader(header: SessionHeader): boolean {
  const id = String(header.id);
  return (
    isConsoleSessionId(id) &&
    (header.parentSession === undefined ||
      id.startsWith(CONSOLE_FORK_PREFIX)) &&
    !('origin' in header && header.origin === 'subagent')
  );
}
