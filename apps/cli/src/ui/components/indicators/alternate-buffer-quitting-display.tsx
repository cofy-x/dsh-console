/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { useUIState } from '../../contexts/ui-state-context.js';
import { AppHeader } from '../layout/app-header.js';
import { HistoryItemDisplay } from '../session/history-item-display.js';
import { QuittingDisplay } from './quitting-display.js';
import { useAppContext } from '../../contexts/app-context.js';
import { MAX_AGENT_MESSAGE_LINES } from './constants.js';
import { theme } from '../../theme/colors.js';
import { useApprovalRuntime } from '../../contexts/approval-context.js';

export const AlternateBufferQuittingDisplay = () => {
  const { version } = useAppContext();
  const uiState = useUIState();
  const { snapshot: approvalSnapshot } = useApprovalRuntime();
  const pendingApproval = approvalSnapshot.pending[0];

  // We render the entire chat history and header here to ensure that the
  // conversation history is visible to the user after the app quits and the
  // user exits alternate buffer mode.
  // Our version of Ink is clever and will render a final frame outside of
  // the alternate buffer on app exit.
  return (
    <Box
      flexDirection="column"
      flexShrink={0}
      flexGrow={0}
      width={uiState.terminalWidth}
    >
      <AppHeader key="app-header" version={version} />
      {uiState.history.map((h) => (
        <HistoryItemDisplay
          terminalWidth={uiState.mainAreaWidth}
          availableTerminalHeight={undefined}
          availableTerminalHeightAgent={MAX_AGENT_MESSAGE_LINES}
          key={h.id}
          item={h}
          isPending={false}
          commands={uiState.slashCommands}
        />
      ))}
      {uiState.pendingHistoryItems.map((item, i) => (
        <HistoryItemDisplay
          key={i}
          availableTerminalHeight={undefined}
          terminalWidth={uiState.mainAreaWidth}
          item={{ ...item, id: 0 }}
          isPending={true}
          isFocused={false}
          activeShellPtyId={uiState.activePtyId}
          embeddedShellFocused={uiState.embeddedShellFocused}
        />
      ))}
      {pendingApproval !== undefined && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text color={theme.status.warning} bold>
            Action Required (was prompted):
          </Text>
          <Text color={theme.text.primary}>{pendingApproval.toolName}</Text>
          {pendingApproval.reason !== undefined && (
            <Text color={theme.text.secondary}>{pendingApproval.reason}</Text>
          )}
        </Box>
      )}
      <QuittingDisplay />
    </Box>
  );
};
