/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { useUIState } from '../../contexts/ui-state-context.js';
import { HistoryItemDisplay } from '../session/history-item-display.js';
import { useTerminalSize } from '../../hooks/terminal/use-terminal-size.js';

export const QuittingDisplay = () => {
  const uiState = useUIState();
  const { rows: terminalHeight, columns: terminalWidth } = useTerminalSize();

  const availableTerminalHeight = terminalHeight;

  if (!uiState.quittingMessages) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {uiState.quittingMessages.map((item) => (
        <HistoryItemDisplay
          key={item.id}
          availableTerminalHeight={
            uiState.constrainHeight ? availableTerminalHeight : undefined
          }
          terminalWidth={terminalWidth}
          item={item}
          isPending={false}
        />
      ))}
    </Box>
  );
};
