/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import type { SubagentCatalogRuntime } from '../../subagent-catalog-runtime.js';
import { AgentsDialog } from './agents-dialog.js';

describe('AgentsDialog', () => {
  it('renders nested official subagent facts and details', () => {
    const snapshot = {
      rootSessionId: 'main',
      status: 'ready' as const,
      runningCount: 1,
      items: [
        {
          kind: 'agent' as const,
          id: 'dsh-console-subagent-research',
          parentId: 'main',
          depth: 1,
          label: 'Research',
          mode: 'continuable' as const,
          activity: 'running' as const,
          hasChildren: false,
        },
      ],
    };
    const runtime: SubagentCatalogRuntime = {
      getSnapshot: () => snapshot,
      subscribe: () => vi.fn(),
      refresh: vi.fn(async () => undefined),
      openTranscript: vi.fn(),
    };
    const { lastFrame } = renderWithProviders(
      <AgentsDialog runtime={runtime} onClose={vi.fn()} />,
    );

    expect(lastFrame()).toContain('DSH Agents (1)');
    expect(lastFrame()).toContain('Research');
    expect(lastFrame()).toContain('continuable');
    expect(lastFrame()).toContain('running');
  });

  it('renders the empty Main Session state', () => {
    const snapshot = {
      rootSessionId: 'main',
      status: 'ready' as const,
      runningCount: 0,
      items: [],
    };
    const runtime: SubagentCatalogRuntime = {
      getSnapshot: () => snapshot,
      subscribe: () => vi.fn(),
      refresh: vi.fn(async () => undefined),
      openTranscript: vi.fn(),
    };
    const { lastFrame } = renderWithProviders(
      <AgentsDialog runtime={runtime} onClose={vi.fn()} />,
    );
    expect(lastFrame()).toContain('has not delegated any subagents');
  });
});
