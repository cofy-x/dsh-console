/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import { escapeAnsiCtrlCodes } from '../../../text/processing.js';
import type { HistoryItem } from '../../types.js';
import { UserMessage } from '../messages/user-message.js';
import { UserShellMessage } from '../messages/user-shell-message.js';
import { ConversationMessage } from '../messages/conversation-message.js';
import { InfoMessage } from '../messages/info-message.js';
import { ErrorMessage } from '../messages/error-message.js';
import { ToolGroupMessage } from '../messages/tool-group-message.js';
import { WarningMessage } from '../messages/warning-message.js';
import { Box } from 'ink';
import { AboutBox } from '../dialogs/about-box.js';
import { StatsDisplay } from '../stats/stats-display.js';
import { SessionSummaryDisplay } from './session-summary-display.js';
import { Help } from '../help/help.js';
import type { SlashCommand } from '../../commands/types.js';
import { ModelMessage } from '../messages/model-message.js';

interface HistoryItemDisplayProps {
  item: HistoryItem;
  separateFromPrevious?: boolean;
  availableTerminalHeight?: number;
  terminalWidth: number;
  isPending: boolean;
  isFocused?: boolean;
  commands?: readonly SlashCommand[];
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  availableTerminalHeightAgent?: number;
}

export const HistoryItemDisplay: React.FC<HistoryItemDisplayProps> = ({
  item,
  separateFromPrevious = false,
  availableTerminalHeight,
  terminalWidth,
  isPending,
  commands,
  isFocused = true,
  activeShellPtyId,
  embeddedShellFocused,
  availableTerminalHeightAgent,
}) => {
  const itemForDisplay = useMemo(() => escapeAnsiCtrlCodes(item), [item]);

  return (
    <Box
      flexDirection="column"
      key={itemForDisplay.id}
      width={terminalWidth}
      marginTop={separateFromPrevious ? 1 : 0}
    >
      {/* Render standard message types */}
      {itemForDisplay.type === 'user' && (
        <UserMessage text={itemForDisplay.text} width={terminalWidth} />
      )}
      {itemForDisplay.type === 'user_shell' && (
        <UserShellMessage text={itemForDisplay.text} width={terminalWidth} />
      )}
      {itemForDisplay.type === 'dsh_assistant' && (
        <ConversationMessage
          content={itemForDisplay.content}
          interrupted={itemForDisplay.interrupted}
          turnMetrics={itemForDisplay.turnMetrics}
          pending={isPending}
          availableTerminalHeight={availableTerminalHeightAgent}
          terminalWidth={terminalWidth}
        />
      )}
      {itemForDisplay.type === 'dsh_user' && (
        <ConversationMessage
          role="user"
          content={itemForDisplay.content}
          availableTerminalHeight={availableTerminalHeight}
          terminalWidth={terminalWidth}
        />
      )}
      {itemForDisplay.type === 'info' && (
        <InfoMessage
          text={itemForDisplay.text}
          icon={itemForDisplay.icon}
          color={itemForDisplay.color}
        />
      )}
      {itemForDisplay.type === 'warning' && (
        <WarningMessage text={itemForDisplay.text} />
      )}
      {itemForDisplay.type === 'error' && (
        <ErrorMessage text={itemForDisplay.text} />
      )}
      {itemForDisplay.type === 'about' && (
        <AboutBox
          cliVersion={itemForDisplay.cliVersion}
          osVersion={itemForDisplay.osVersion}
          modelVersion={itemForDisplay.modelVersion}
        />
      )}
      {itemForDisplay.type === 'help' && commands && (
        <Help commands={commands} />
      )}
      {itemForDisplay.type === 'stats' && (
        <StatsDisplay duration={itemForDisplay.duration} />
      )}
      {itemForDisplay.type === 'model' && (
        <ModelMessage model={itemForDisplay.model} />
      )}
      {itemForDisplay.type === 'quit' && (
        <SessionSummaryDisplay duration={itemForDisplay.duration} />
      )}
      {itemForDisplay.type === 'tool_group' && (
        <ToolGroupMessage
          toolCalls={itemForDisplay.tools}
          groupId={itemForDisplay.id}
          availableTerminalHeight={availableTerminalHeight}
          terminalWidth={terminalWidth}
          isFocused={isFocused}
          activeShellPtyId={activeShellPtyId}
          embeddedShellFocused={embeddedShellFocused}
        />
      )}
    </Box>
  );
};
