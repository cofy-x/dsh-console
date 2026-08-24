/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { profilerCommand } from './profiler-command.js';

describe('profilerCommand', () => {
  it('toggles the render diagnostics panel', async () => {
    const toggleDebugProfiler = vi.fn();
    const context = createMockCommandContext({ ui: { toggleDebugProfiler } });

    await profilerCommand.action?.(context, '');

    expect(toggleDebugProfiler).toHaveBeenCalledOnce();
  });
});
