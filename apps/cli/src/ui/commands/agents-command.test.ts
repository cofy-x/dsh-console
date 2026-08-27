/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { SubagentCatalogRuntime } from '../subagent-catalog-runtime.js';
import { agentsCommand } from './agents-command.js';

describe('agentsCommand', () => {
  it('opens the DSH Agents dialog', () => {
    const runtime: SubagentCatalogRuntime = {
      getSnapshot: () => ({
        rootSessionId: 'main',
        status: 'ready',
        items: [],
        runningCount: 0,
      }),
      subscribe: () => vi.fn(),
      refresh: vi.fn(async () => undefined),
      openTranscript: vi.fn(),
    };
    const context = createMockCommandContext({
      services: { subagentCatalog: runtime },
    });

    expect(agentsCommand.action?.(context, '')).toMatchObject({
      type: 'custom_dialog',
    });
  });

  it('reports an unavailable catalog', () => {
    expect(agentsCommand.action?.(createMockCommandContext(), '')).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'DSH Agent catalog is unavailable.',
    });
  });
});
