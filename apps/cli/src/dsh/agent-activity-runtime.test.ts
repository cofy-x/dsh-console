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
import { JobId, type JobEventListener } from '@deepseek-ai/dsh-jobs';
import { SessionId } from '@deepseek-ai/dsh-session';
import { DshAgentActivityRuntime } from './agent-activity-runtime.js';

function agent(id: string): Agent {
  return {
    session: { id: SessionId(id) },
  } as unknown as Agent;
}

function harness() {
  let active: Agent | undefined = agent('dsh-console-main');
  let goal: DshGoalView | undefined;
  let changed: JobEventListener = () => {};
  const off = vi.fn();
  const ownJob = {
    id: JobId('bash-1'),
    kind: 'bash',
    label: 'background build',
    owner: SessionId('dsh-console-main'),
    status: 'running' as const,
    startedAt: 1,
    output: { total: 0, earliest: 0 },
  };
  const jobs = {
    list: vi.fn(() => [
      ownJob,
      {
        ...ownJob,
        id: JobId('bash-2'),
        owner: SessionId('dsh-console-side-x'),
        label: 'private side output',
      },
      { ...ownJob, id: JobId('bash-3'), owner: undefined },
    ]),
    get: vi.fn(() => ownJob),
    kill: vi.fn(),
    read: vi.fn(),
    wait: vi.fn(),
    events: {
      subscribe: vi.fn((_filter, listener: JobEventListener) => {
        changed = listener;
        return off;
      }),
    },
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
    jobs,
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
    changed: () => changed({ type: 'progress', job: ownJob }),
    emitJob: (event: Parameters<JobEventListener>[0]) => changed(event),
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
      h.active()?.session.id,
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
  it('ignores output and foreign-session notifications without reading output', () => {
    const h = harness();
    const listener = vi.fn();
    h.runtime.subscribe(listener);
    h.emitJob({
      type: 'output',
      id: JobId('bash-1'),
      owner: SessionId('dsh-console-main'),
      total: 100,
    });
    h.emitJob({
      type: 'progress',
      job: { ...h.jobs.get(), owner: SessionId('other') },
    });
    expect(listener).not.toHaveBeenCalled();
    h.changed();
    expect(listener).toHaveBeenCalledOnce();
    expect(h.jobs.list).toHaveBeenCalledWith(SessionId('dsh-console-main'));
    expect(h.jobs.read).not.toHaveBeenCalled();
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
