/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type { InteractionModeSnapshot } from '../../interaction-mode-runtime.js';
import { theme } from '../../theme/colors.js';
import {
  interactionModeColor,
  interactionModeLabel,
} from './interaction-mode-style.js';

export const InteractionModeIndicator = ({
  mode,
}: {
  mode: InteractionModeSnapshot;
}) => {
  if (mode.kind === 'unavailable' || (mode.kind === 'default' && !mode.pending))
    return null;
  const label = interactionModeLabel(mode.kind, mode.label);

  return (
    <Box paddingX={1}>
      <Text
        bold
        color={interactionModeColor(mode.kind) ?? theme.text.secondary}
        aria-label={`Interaction mode: ${label}${
          mode.showPermission && mode.permissionLabel
            ? `, permission: ${mode.permissionLabel}`
            : ''
        }${mode.pending ? ', pending' : ''}`}
      >
        {label}
        {mode.showPermission && mode.permissionLabel && (
          <>
            <Text color={theme.text.secondary}> {' ['}</Text>
            <Text
              color={
                mode.permissionRequiresConfirmation
                  ? theme.status.error
                  : theme.text.secondary
              }
            >
              {mode.permissionLabel}
            </Text>
            <Text color={theme.text.secondary}>]</Text>
          </>
        )}
        {mode.busy ? (
          <Text color={theme.text.secondary}> (switching...)</Text>
        ) : mode.pending ? (
          <Text color={theme.text.secondary}> (pending)</Text>
        ) : null}
      </Text>
    </Box>
  );
};
