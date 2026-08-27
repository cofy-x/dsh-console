/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@deepseek-ai/dsh-session';
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent';
import { DshSubagentCatalogRuntime } from './subagent-catalog-runtime.js';

const transcriptDependencies = [
  { readSession: vi.fn() },
  { presentCall: vi.fn(), presentResult: vi.fn() },
  () => vi.fn(),
] as const;

describe('DshSubagentCatalogRuntime', () => {
  it('projects the official descendant catalog into a stable UI snapshot', async () => {
    const listDescendants = vi.fn(async () => [
      {
        kind: 'child' as const,
        id: 'child-1' as SessionId,
        parentId: 'main-1' as SessionId,
        depth: 1,
        activity: 'running' as const,
        hasChildren: true,
        mode: 'continuable' as const,
        label: 'Research',
      },
      {
        kind: 'diagnostic' as const,
        id: 'child-2' as SessionId,
        parentId: 'child-1' as SessionId,
        depth: 2,
        reason: 'corrupt' as const,
      },
    ]);
    const runtime = new DshSubagentCatalogRuntime(
      { listDescendants },
      () => 'main-1' as SessionId,
      () => vi.fn(),
      ...transcriptDependencies,
    );

    await runtime.refresh();

    expect(runtime.getSnapshot()).toMatchObject({
      rootSessionId: 'main-1',
      status: 'ready',
      runningCount: 1,
      items: [
        { kind: 'agent', label: 'Research', activity: 'running', depth: 1 },
        { kind: 'diagnostic', reason: 'corrupt', depth: 2 },
      ],
    });
    runtime.dispose();
  });

  it('clears the previous tree when the Main Agent changes', async () => {
    let root = 'main-1' as SessionId;
    const runtime = new DshSubagentCatalogRuntime(
      { listDescendants: vi.fn(async () => []) },
      () => root,
      () => vi.fn(),
      ...transcriptDependencies,
    );
    await runtime.refresh();
    root = 'main-2' as SessionId;

    runtime.activeAgentChanged();

    expect(runtime.getSnapshot()).toMatchObject({
      rootSessionId: 'main-2',
      runningCount: 0,
      items: [],
    });
    runtime.dispose();
  });

  it('cancels an in-flight catalog read when disposed', async () => {
    let observedSignal: AbortSignal | undefined;
    const runtime = new DshSubagentCatalogRuntime(
      {
        listDescendants: vi.fn((_root, signal) => {
          observedSignal = signal;
          return new Promise((_resolve, reject) => {
            signal?.addEventListener(
              'abort',
              () => reject(new DOMException('cancelled', 'AbortError')),
              { once: true },
            );
          });
        }),
      } as Pick<SubagentRuntime, 'listDescendants'>,
      () => 'main-1' as SessionId,
      () => vi.fn(),
      ...transcriptDependencies,
    );
    const refresh = runtime.refresh();

    runtime.dispose();

    expect(observedSignal?.aborted).toBe(true);
    await refresh;
  });
});
