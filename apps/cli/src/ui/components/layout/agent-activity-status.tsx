/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useUIActions } from '../../contexts/ui-actions-context.js';
import { theme } from '../../theme/colors.js';
import { InteractiveRegion } from '../shared/interactive-region.js';
import { plainPanelLine } from '../dialogs/activity-dialog-shared.js';

export function AgentActivityStatus() {
  const { agentActivity, terminalWidth } = useUIState();
  const { handleFinalSubmit } = useUIActions();
  const jobs =
    agentActivity?.jobs.filter(
      (job) => job.status === 'running' || job.status === 'stopping',
    ).length ?? 0;
  const goal =
    agentActivity?.goal?.phase === 'complete' ? undefined : agentActivity?.goal;
  if (jobs === 0 && goal === undefined && !agentActivity?.error) return null;
  return (
    <Box width={terminalWidth} paddingX={1} flexDirection="row">
      {jobs > 0 && (
        <InteractiveRegion
          onPress={() => handleFinalSubmit('/jobs')}
          flexShrink={0}
        >
          <Text color={theme.status.success}>{jobs} jobs /jobs </Text>
        </InteractiveRegion>
      )}
      {goal && (
        <InteractiveRegion
          onPress={() => handleFinalSubmit('/goals')}
          flexShrink={1}
        >
          <Text
            color={
              goal.phase === 'blocked'
                ? theme.status.error
                : goal.activation === 'armed'
                  ? theme.text.accent
                  : theme.status.warning
            }
            wrap="truncate"
          >
            {goal.phase === 'blocked'
              ? 'Goal blocked'
              : goal.phase === 'paused'
                ? 'Goal paused'
                : goal.activation === 'disarmed'
                  ? 'Goal ready to resume'
                  : goal.roundsStarted === 0
                    ? 'Goal ready'
                    : `Goal · Round ${goal.roundsStarted}`}{' '}
            · {plainPanelLine(goal.objective)} /goals
          </Text>
        </InteractiveRegion>
      )}
      {agentActivity?.error && (
        <Text color={theme.status.warning}>Activity unavailable /goals</Text>
      )}
    </Box>
  );
}
