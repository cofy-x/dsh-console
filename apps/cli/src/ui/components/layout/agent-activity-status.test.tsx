/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import type { AgentActivitySnapshot } from '../../agent-activity-runtime.js';
import { AgentActivityStatus } from './agent-activity-status.js';

function renderStatus(agentActivity: AgentActivitySnapshot) {
  return renderWithProviders(<AgentActivityStatus />, {
    uiState: { agentActivity },
  }).lastFrame;
}

describe('AgentActivityStatus', () => {
  it('shows actionable active Goal context without presenting the round cap as progress', () => {
    const frame = renderStatus({
      jobs: [],
      busy: false,
      goal: {
        id: 'goal-1',
        revision: 1,
        objective: 'Ship the release',
        phase: 'active',
        activation: 'armed',
        roundsStarted: 2,
        maxGoalRounds: 256,
      },
    })();
    expect(frame).toContain('Goal · Round 2 · Ship the release /goals');
    expect(frame).not.toContain('/256');
  });

  it('uses user-facing language for a restored disarmed Goal', () => {
    const frame = renderStatus({
      jobs: [],
      busy: false,
      goal: {
        id: 'goal-1',
        revision: 1,
        objective: 'Resume migration',
        phase: 'active',
        activation: 'disarmed',
        roundsStarted: 2,
        maxGoalRounds: 8,
      },
    })();
    expect(frame).toContain('Goal ready to resume · Resume migration /goals');
    expect(frame).not.toContain('disarmed');
  });

  it('removes completed Goals from the persistent footer', () => {
    const frame = renderStatus({
      jobs: [],
      busy: false,
      goal: {
        id: 'goal-1',
        revision: 2,
        objective: 'Finished work',
        phase: 'complete',
        activation: 'disarmed',
        roundsStarted: 1,
        maxGoalRounds: 256,
      },
    })();
    expect(frame ?? '').not.toContain('Goal');
  });
});
