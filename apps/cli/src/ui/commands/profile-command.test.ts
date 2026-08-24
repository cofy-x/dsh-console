/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { profileCommand } from './profile-command.js';

describe('profileCommand', () => {
  it('toggles the TUI render profiler', async () => {
    const toggleDebugProfiler = vi.fn();
    const context = createMockCommandContext({ ui: { toggleDebugProfiler } });

    await profileCommand.action?.(context, '');

    expect(toggleDebugProfiler).toHaveBeenCalledOnce();
  });
});
