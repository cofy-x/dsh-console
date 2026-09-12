/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface JobView {
  id: string;
  kind: string;
  label: string;
  sessionId: string;
  status: 'running' | 'stopping' | 'completed' | 'killed' | 'failed';
  detail?: string;
  startedAt: number;
  finishedAt?: number;
}

export interface GoalView {
  id: string;
  revision: number;
  objective: string;
  phase: 'active' | 'paused' | 'blocked' | 'complete';
  activation: 'armed' | 'disarmed';
  roundsStarted: number;
  maxGoalRounds: number;
  blockedReason?: string;
}

export interface AgentActivitySnapshot {
  sessionId?: string;
  jobs: readonly JobView[];
  goal?: GoalView;
  busy: boolean;
  error?: string;
}

/** An action is bound to the observation the user actually confirmed. */
export interface GoalExpectation {
  sessionId?: string;
  goal?: Pick<GoalView, 'id' | 'revision'>;
}

export type GoalAction =
  | { kind: 'create'; objective: string; maxGoalRounds?: number }
  | { kind: 'edit'; objective?: string; maxGoalRounds?: number }
  | { kind: 'pause' | 'resume' | 'complete' | 'clear' };

export interface AgentActivityRuntime {
  getSnapshot(): AgentActivitySnapshot;
  subscribe(listener: () => void): () => void;
  stopJob(sessionId: string, jobId: string): void;
  changeGoal(
    expected: GoalExpectation,
    action: GoalAction,
    signal?: AbortSignal,
  ): Promise<void>;
}

export const EMPTY_AGENT_ACTIVITY: AgentActivitySnapshot = Object.freeze({
  jobs: Object.freeze([]),
  busy: false,
});

export const emptyAgentActivitySnapshot = (): AgentActivitySnapshot =>
  EMPTY_AGENT_ACTIVITY;
