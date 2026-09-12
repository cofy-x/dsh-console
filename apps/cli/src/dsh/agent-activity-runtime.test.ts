/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  GoalService,
  GoalView as DshGoalView,
} from '@deepseek-ai/dsh-goal';
import { JobId, type JobRegistry } from '@deepseek-ai/dsh-jobs';
import { SessionId } from '@deepseek-ai/dsh-session';
import { DshAgentActivityRuntime } from './agent-activity-runtime.js';

function agent(id: string): Agent {
  return {
    session: { id: SessionId(id), snapshotEvents: () => [], events: [] },
  } as unknown as Agent;
}

function harness() {
  let active: Agent | undefined = agent('dsh-console-main');
  let goal: DshGoalView | undefined;
  let changed = (_owner: Agent | undefined) => {};
  const off = vi.fn();
  const ownJob = {
    id: JobId('bash-1'),
    kind: 'bash',
    label: 'background build',
    ownerSession: SessionId('dsh-console-main'),
    status: 'running',
    startedAt: 1,
    reported: false,
  };
  const jobs = {
    list: vi.fn(() => [
      ownJob,
      {
        ...ownJob,
        id: JobId('bash-2'),
        ownerSession: SessionId('dsh-console-side-x'),
        label: 'private side output',
      },
      { ...ownJob, id: JobId('bash-3'), ownerSession: undefined },
    ]),
    get: vi.fn(() => ownJob),
    kill: vi.fn(),
    read: vi.fn(),
    wait: vi.fn(),
    onJobsChanged: vi.fn((listener) => {
      changed = listener;
      return off;
    }),
  };
  const goals = {
    get: vi.fn(() => goal),
    create: vi.fn((_agent, request) => {
      goal = {
        id: 'goal-1',
        revision: 1,
        objective: request.objective,
        phase: 'active',
        activation: 'armed',
        maxGoalRounds: request.maxGoalRounds ?? 4,
        roundsStarted: 0,
        createdAt: 1,
        updatedAt: 1,
      } as DshGoalView;
      return goal;
    }),
    edit: vi.fn(),
    pause: vi.fn(() => {
      goal = {
        ...goal!,
        phase: 'paused',
        activation: 'disarmed',
        revision: goal!.revision + 1,
      };
      return goal;
    }),
    resume: vi.fn(() => {
      goal = {
        ...goal!,
        phase: 'active',
        activation: 'armed',
        revision: goal!.revision + 1,
      };
      return goal;
    }),
    complete: vi.fn(() => {
      goal = {
        ...goal!,
        phase: 'complete',
        activation: 'disarmed',
        revision: goal!.revision + 1,
      };
      return goal;
    }),
    clear: vi.fn(() => {
      goal = undefined;
    }),
  };
  const sessions = { flush: vi.fn(async () => true) };
  const ensure = vi.fn(async () => {
    active = agent('dsh-console-new');
    return active;
  });
  const runtime = new DshAgentActivityRuntime(
    jobs as unknown as JobRegistry,
    goals as unknown as GoalService,
    sessions,
    () => active,
    ensure,
    () => off,
    () => off,
  );
  return {
    runtime,
    jobs,
    goals,
    sessions,
    ensure,
    off,
    changed: () => changed(active),
    active: () => active,
    switch: (next?: Agent) => {
      active = next;
      runtime.activeAgentChanged();
    },
    replaceGoal: (next: DshGoalView) => {
      goal = next;
      runtime.activeAgentChanged();
    },
  };
}

describe('DshAgentActivityRuntime', () => {
  it('observes only owned jobs without consuming output or notices', () => {
    const h = harness();
    expect(h.runtime.getSnapshot().jobs.map((job) => job.id)).toEqual([
      'bash-1',
    ]);
    h.changed();
    expect(h.jobs.read).not.toHaveBeenCalled();
    expect(h.jobs.wait).not.toHaveBeenCalled();
    h.runtime.dispose();
  });
  it('fences stop by Session and exact active owner', () => {
    const h = harness();
    h.runtime.stopJob('dsh-console-main', 'bash-1');
    expect(h.jobs.kill).toHaveBeenCalledWith(
      'bash-1',
      h.active(),
      expect.stringContaining('user'),
    );
    h.switch(agent('dsh-console-side-x'));
    expect(() => h.runtime.stopJob('dsh-console-main', 'bash-1')).toThrow(
      'active Session changed',
    );
    expect(h.jobs.kill).toHaveBeenCalledTimes(1);
    h.runtime.dispose();
  });
  it('does not instantiate an Agent merely to show empty activity', () => {
    const h = harness();
    h.switch(undefined);
    expect(h.runtime.getSnapshot().jobs).toEqual([]);
    expect(h.ensure).not.toHaveBeenCalled();
    h.runtime.dispose();
  });
  it('creates lazily and checkpoints goal mutations', async () => {
    const h = harness();
    h.switch(undefined);
    await h.runtime.changeGoal(
      {},
      { kind: 'create', objective: 'Finish the build', maxGoalRounds: 3 },
    );
    expect(h.runtime.getSnapshot().goal).toMatchObject({
      objective: 'Finish the build',
      activation: 'armed',
      maxGoalRounds: 3,
    });
    expect(h.sessions.flush).toHaveBeenCalledWith(h.active()?.session);
    h.runtime.dispose();
  });
  it('rejects stale goal observations instead of silently overwriting them', async () => {
    const h = harness();
    await h.runtime.changeGoal(
      { sessionId: 'dsh-console-main' },
      { kind: 'create', objective: 'A' },
    );
    await expect(
      h.runtime.changeGoal(
        { sessionId: 'dsh-console-main' },
        { kind: 'clear' },
      ),
    ).rejects.toThrow('goal changed');
    expect(h.goals.clear).not.toHaveBeenCalled();
    h.runtime.dispose();
  });
  it('passes current CAS refs through pause, resume, complete, and clear', async () => {
    const h = harness();
    await h.runtime.changeGoal(
      { sessionId: 'dsh-console-main' },
      { kind: 'create', objective: 'A' },
    );
    for (const kind of ['pause', 'resume', 'complete', 'clear'] as const) {
      const current = h.runtime.getSnapshot();
      const ref = { id: current.goal!.id, revision: current.goal!.revision };
      await h.runtime.changeGoal(
        { sessionId: current.sessionId, goal: ref },
        { kind },
      );
      expect(h.goals[kind]).toHaveBeenCalledWith(h.active(), ref);
    }
    expect(h.runtime.getSnapshot().goal).toBeUndefined();
    h.runtime.dispose();
  });
  it('shows restored active goals as disarmed without resuming them', async () => {
    const h = harness();
    await h.runtime.changeGoal(
      { sessionId: 'dsh-console-main' },
      { kind: 'create', objective: 'A' },
    );
    h.replaceGoal({ ...h.goals.get()!, activation: 'disarmed' });
    expect(h.runtime.getSnapshot().goal?.activation).toBe('disarmed');
    expect(h.goals.resume).not.toHaveBeenCalled();
    h.runtime.dispose();
  });
  it('reports committed-but-unflushed mutations honestly and releases its lock', async () => {
    const h = harness();
    h.sessions.flush.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      h.runtime.changeGoal(
        { sessionId: 'dsh-console-main' },
        { kind: 'create', objective: 'A' },
      ),
    ).rejects.toThrow('changed in memory');
    expect(h.runtime.getSnapshot().goal?.objective).toBe('A');
    expect(h.runtime.getSnapshot().busy).toBe(false);
    h.runtime.dispose();
  });
  it('rejects an aborted create before materialization', async () => {
    const h = harness();
    h.switch(undefined);
    const controller = new AbortController();
    controller.abort();
    await expect(
      h.runtime.changeGoal(
        {},
        { kind: 'create', objective: 'A' },
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(h.ensure).not.toHaveBeenCalled();
    h.runtime.dispose();
  });
  it('releases subscriptions and disallows commands after disposal', () => {
    const h = harness();
    h.runtime.dispose();
    expect(h.off).toHaveBeenCalledTimes(3);
    expect(() => h.runtime.stopJob('dsh-console-main', 'bash-1')).toThrow();
  });
});
