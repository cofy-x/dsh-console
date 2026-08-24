/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { statsCommand } from './stats-command.js';

describe('statsCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:01Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('adds a stats item for the current DSH session', async () => {
    const context = createMockCommandContext({
      session: { stats: { sessionStartTime: new Date('2026-01-01T00:00:00Z') } },
    });

    await statsCommand.action?.(context, '');

    expect(context.ui.addItem).toHaveBeenCalledWith(
      { type: 'stats', duration: '1.0s' },
      Date.now(),
    );
  });
});
