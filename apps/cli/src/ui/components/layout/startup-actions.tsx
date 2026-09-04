/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { useUIActions } from '../../contexts/ui-actions-context.js';
import { InteractiveRegion } from '../shared/interactive-region.js';

const ACTIONS = [
  { label: 'Resume session', command: '/sessions' },
  { label: 'Changelog', command: '/changelog' },
  { label: 'Help', command: '/help' },
] as const;

interface StartupActionsProps {
  paddingLeft?: number;
}

export function StartupActions({
  paddingLeft = 0,
}: StartupActionsProps): React.JSX.Element {
  const { handleFinalSubmit } = useUIActions();

  return (
    <Box marginTop={1} paddingLeft={paddingLeft}>
      {ACTIONS.map((action, index) => (
        <React.Fragment key={action.command}>
          {index > 0 && <Text color={theme.text.secondary}> · </Text>}
          <InteractiveRegion onPress={() => handleFinalSubmit(action.command)}>
            <Text color={theme.text.link} underline>
              {action.label}
            </Text>
          </InteractiveRegion>
        </React.Fragment>
      ))}
    </Box>
  );
}
