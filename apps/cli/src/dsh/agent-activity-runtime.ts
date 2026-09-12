/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import { JobId, type JobRegistry } from '@deepseek-ai/dsh-jobs';
import type { GoalService, GoalRef } from '@deepseek-ai/dsh-goal';
import type {
  Session,
  SessionEvent,
  SessionStore,
} from '@deepseek-ai/dsh-session';
import type {
  AgentActivityRuntime,
  AgentActivitySnapshot,
  GoalAction,
  GoalExpectation,
} from '../ui/agent-activity-runtime.js';

export class DshAgentActivityRuntime implements AgentActivityRuntime {
  private readonly listeners = new Set<() => void>();
  private readonly off: () => void;
  private snapshot: AgentActivitySnapshot = { jobs: [], busy: false };
  private changing = false;
  private disposed = false;
  private generation = 0;

  constructor(
    private readonly jobs: Pick<
      JobRegistry,
      'list' | 'get' | 'kill' | 'onJobsChanged'
    >,
    private readonly goals: Pick<
      GoalService,
      'get' | 'create' | 'edit' | 'pause' | 'resume' | 'complete' | 'clear'
    >,
    private readonly sessions: Pick<SessionStore, 'flush'>,
    private readonly activeAgent: () => Agent | undefined,
    private readonly ensureAgent: (signal: AbortSignal) => Promise<Agent>,
    subscribeSession: (
      listener: (session: Session, event: SessionEvent) => void,
    ) => () => void,
    subscribeActivation: (listener: () => void) => () => void,
    private readonly isSwitching: () => boolean = () => false,
  ) {
    const offJobs = jobs.onJobsChanged((owner) => {
      if (owner === this.activeAgent()) this.refresh();
    });
    const offSession = subscribeSession((session, event) => {
      if (
        session === this.activeAgent()?.session &&
        event.type.startsWith('goal/')
      )
        this.refresh();
    });
    const offActivation = subscribeActivation(() => this.refresh());
    this.off = () => {
      offJobs();
      offSession();
      offActivation();
    };
    this.refresh();
  }

  getSnapshot = (): AgentActivitySnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  activeAgentChanged(): void {
    this.generation += 1;
    this.refresh();
  }

  stopJob(sessionId: string, jobId: string): void {
    const agent = this.activeAgent();
    if (
      this.disposed ||
      this.isSwitching() ||
      agent === undefined ||
      String(agent.session.id) !== sessionId
    ) {
      throw new Error(
        'The active Session changed. Reopen Jobs before stopping work.',
      );
    }
    const job = this.jobs.get(JobId(jobId), agent);
    if (String(job.ownerSession) !== sessionId)
      throw new Error('This job belongs to another Session.');
    this.jobs.kill(job.id, agent, 'Stopped by the user in DSH Console.');
    this.refresh();
  }

  async changeGoal(
    expected: GoalExpectation,
    action: GoalAction,
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.disposed || this.changing || this.isSwitching())
      throw new Error('Another Agent change is in progress.');
    const original = this.activeAgent();
    if (
      (original === undefined ? undefined : String(original.session.id)) !==
      expected.sessionId
    ) {
      throw new Error(
        'The active Session changed. Review the current goal first.',
      );
    }
    const generation = this.generation;
    this.changing = true;
    this.refresh();
    try {
      signal?.throwIfAborted();
      const agent =
        original ??
        (await this.ensureAgent(signal ?? new AbortController().signal));
      signal?.throwIfAborted();
      // Lazy materialization intentionally changes identity once; an existing
      // live Agent must remain exactly the one the user observed.
      if (
        this.disposed ||
        agent !== this.activeAgent() ||
        (original !== undefined && this.generation !== generation)
      ) {
        throw new Error('The active Agent changed before the goal operation.');
      }
      const current = this.goals.get(agent);
      if (
        current?.id !== expected.goal?.id ||
        current?.revision !== expected.goal?.revision
      ) {
        throw new Error(
          'The goal changed since it was displayed. Review it and try again.',
        );
      }
      if (action.kind === 'create') {
        this.goals.create(agent, {
          objective: action.objective,
          maxGoalRounds: action.maxGoalRounds,
        });
      } else {
        if (current === undefined)
          throw new Error('No goal is set for this Session.');
        const ref: GoalRef = { id: current.id, revision: current.revision };
        if (action.kind === 'edit')
          this.goals.edit(agent, ref, {
            objective: action.objective,
            maxGoalRounds: action.maxGoalRounds,
          });
        else this.goals[action.kind](agent, ref);
      }
      try {
        if (!(await this.sessions.flush(agent.session)))
          throw new Error('No persistence writer is available.');
      } catch (error) {
        throw new Error(
          `Goal changed in memory, but its durability checkpoint failed: ${String(error)}`,
          { cause: error },
        );
      }
    } finally {
      this.changing = false;
      this.refresh();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    this.off();
    this.listeners.clear();
  }

  private refresh(): void {
    if (this.disposed) return;
    const agent = this.activeAgent();
    try {
      const sessionId =
        agent === undefined ? undefined : String(agent.session.id);
      const goal = agent === undefined ? undefined : this.goals.get(agent);
      this.snapshot = {
        sessionId,
        busy: this.changing,
        jobs:
          agent === undefined
            ? []
            : this.jobs
                .list(agent)
                .filter((job) => job.ownerSession === agent.session.id)
                .map((job) => ({
                  id: String(job.id),
                  kind: String(job.kind),
                  label: job.label,
                  sessionId: String(agent.session.id),
                  status: job.status,
                  detail: job.detail,
                  startedAt: job.startedAt,
                  finishedAt: job.finishedAt,
                })),
        goal:
          goal === undefined
            ? undefined
            : {
                id: String(goal.id),
                revision: goal.revision,
                objective: goal.objective,
                phase: goal.phase,
                activation: goal.activation,
                roundsStarted: goal.roundsStarted,
                maxGoalRounds: goal.maxGoalRounds,
                blockedReason:
                  goal.blockedReason === undefined
                    ? undefined
                    : `${goal.blockedReason.code}: ${goal.blockedReason.message}`,
              },
      };
    } catch (error) {
      this.snapshot = { jobs: [], busy: this.changing, error: String(error) };
    }
    for (const listener of this.listeners) listener();
  }
}
