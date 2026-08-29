/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { ToolCallStatus } from '../../types.js';
import { AgentRespondingSpinner } from '../indicators/agent-responding-spinner.js';
import {
  SHELL_COMMAND_NAME,
  SHELL_FOCUS_HINT_DELAY_MS,
  SHELL_NAME,
} from '../../constants.js';
import { theme } from '../../theme/colors.js';
import { SHELL_TOOL_NAME } from '../../../config/shell.js';
import { ASK_USER_DISPLAY_NAME } from '../../question.js';
import { TOOL_STATUS } from '../../theme/symbols.js';
import { useInactivityTimer } from '../../hooks/terminal/use-inactivity-timer.js';
import type { ToolResultDisplay } from '../../tool-result.js';
import type { Config } from '../../../config/config.js';
import { getCachedStringWidth } from '../../../text/processing.js';

export const STATUS_INDICATOR_WIDTH = 3;

function truncateWithSpacedEllipsis(value: string, maxWidth: number): string {
  if (maxWidth <= 1) return '…';

  const contentWidth = maxWidth - getCachedStringWidth(' …');
  if (getCachedStringWidth(value) <= contentWidth) return `${value} …`;

  let width = 0;
  let truncated = '';
  for (const character of Array.from(value)) {
    const characterWidth = getCachedStringWidth(character);
    if (width + characterWidth > contentWidth) break;
    truncated += character;
    width += characterWidth;
  }
  return `${truncated.trimEnd()} …`;
}

export function isToolTitleCollapsible(
  title: string,
  terminalWidth: number,
): boolean {
  const headerContentWidth = Math.max(
    1,
    terminalWidth - STATUS_INDICATOR_WIDTH - 4,
  );
  return getCachedStringWidth(title) > headerContentWidth;
}

/**
 * Returns true if the tool name corresponds to a shell tool.
 */
export function isShellTool(name: string): boolean {
  return (
    name === SHELL_COMMAND_NAME ||
    name === SHELL_NAME ||
    name === SHELL_TOOL_NAME
  );
}

/**
 * Returns true if the shell tool call is currently focusable.
 */
export function isThisShellFocusable(
  name: string,
  status: ToolCallStatus,
  config?: Config,
): boolean {
  return !!(
    isShellTool(name) &&
    status === ToolCallStatus.Executing &&
    config?.getEnableInteractiveShell()
  );
}

/**
 * Returns true if this specific shell tool call is currently focused.
 */
export function isThisShellFocused(
  name: string,
  status: ToolCallStatus,
  ptyId?: number,
  activeShellPtyId?: number | null,
  embeddedShellFocused?: boolean,
): boolean {
  return !!(
    isShellTool(name) &&
    status === ToolCallStatus.Executing &&
    ptyId === activeShellPtyId &&
    embeddedShellFocused
  );
}

/**
 * Hook to manage focus hint state.
 */
export function useFocusHint(
  isThisShellFocusable: boolean,
  isThisShellFocused: boolean,
  resultDisplay: ToolResultDisplay | undefined,
) {
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [userHasFocused, setUserHasFocused] = useState(false);
  const showFocusHint = useInactivityTimer(
    isThisShellFocusable,
    lastUpdateTime ? lastUpdateTime.getTime() : 0,
    SHELL_FOCUS_HINT_DELAY_MS,
  );

  useEffect(() => {
    if (resultDisplay) {
      setLastUpdateTime(new Date());
    }
  }, [resultDisplay]);

  useEffect(() => {
    if (isThisShellFocused) {
      setUserHasFocused(true);
    }
  }, [isThisShellFocused]);

  const shouldShowFocusHint =
    isThisShellFocusable && (showFocusHint || userHasFocused);

  return { shouldShowFocusHint };
}

/**
 * Component to render the focus hint.
 */
export const FocusHint: React.FC<{
  shouldShowFocusHint: boolean;
  isThisShellFocused: boolean;
}> = ({ shouldShowFocusHint, isThisShellFocused }) => {
  if (!shouldShowFocusHint) {
    return null;
  }

  return (
    <Box marginLeft={1} flexShrink={0}>
      <Text color={theme.text.accent}>
        {isThisShellFocused ? '(Focused)' : '(tab to focus)'}
      </Text>
    </Box>
  );
};

export type TextEmphasis = 'high' | 'medium' | 'low';

type ToolStatusIndicatorProps = {
  status: ToolCallStatus;
  name: string;
};

export const ToolStatusIndicator: React.FC<ToolStatusIndicatorProps> = ({
  status,
  name,
}) => {
  const isShell = isShellTool(name);
  const statusColor = isShell ? theme.ui.symbol : theme.status.warning;

  return (
    <Box minWidth={STATUS_INDICATOR_WIDTH}>
      {status === ToolCallStatus.Pending && (
        <Text color={theme.status.success}>{TOOL_STATUS.PENDING}</Text>
      )}
      {status === ToolCallStatus.Executing && (
        <AgentRespondingSpinner
          spinnerType="toggle"
          nonRespondingDisplay={TOOL_STATUS.EXECUTING}
        />
      )}
      {status === ToolCallStatus.Success && (
        <Text color={theme.status.success} aria-label={'Success:'}>
          {TOOL_STATUS.SUCCESS}
        </Text>
      )}
      {status === ToolCallStatus.Canceled && (
        <Text color={statusColor} aria-label={'Canceled:'} bold>
          {TOOL_STATUS.CANCELED}
        </Text>
      )}
      {status === ToolCallStatus.Error && (
        <Text color={theme.status.error} aria-label={'Error:'} bold>
          {TOOL_STATUS.ERROR}
        </Text>
      )}
    </Box>
  );
};

type ToolInfoProps = {
  name: string;
  description: string;
  status: ToolCallStatus;
  emphasis: TextEmphasis;
  hideDescription?: boolean;
  maxNameWidth?: number;
  expandTitle?: boolean;
};

export const ToolInfo: React.FC<ToolInfoProps> = ({
  name,
  description,
  status,
  emphasis,
  hideDescription = false,
  maxNameWidth,
  expandTitle = false,
}) => {
  const nameColor = React.useMemo<string>(() => {
    switch (emphasis) {
      case 'high':
        return theme.text.primary;
      case 'medium':
        return theme.text.primary;
      case 'low':
        return theme.text.secondary;
      default: {
        const exhaustiveCheck: never = emphasis;
        return exhaustiveCheck;
      }
    }
  }, [emphasis]);

  // Hide description for completed Ask User tools (the result display speaks for itself)
  const isCompletedAskUser =
    name === ASK_USER_DISPLAY_NAME &&
    [
      ToolCallStatus.Success,
      ToolCallStatus.Error,
      ToolCallStatus.Canceled,
    ].includes(status);
  const displayName =
    maxNameWidth === undefined
      ? name
      : truncateWithSpacedEllipsis(name, maxNameWidth);

  return (
    <Box
      overflow={expandTitle ? 'visible' : 'hidden'}
      height={expandTitle ? undefined : 1}
      flexGrow={1}
      flexShrink={1}
    >
      <Text
        strikethrough={status === ToolCallStatus.Canceled}
        wrap={expandTitle ? 'wrap' : 'truncate'}
      >
        <Text color={nameColor} bold>
          {displayName}
        </Text>
        {!isCompletedAskUser && !hideDescription && (
          <>
            {' '}
            <Text color={theme.text.secondary}>{description}</Text>
          </>
        )}
      </Text>
    </Box>
  );
};

export const TrailingIndicator: React.FC = () => (
  <Text color={theme.text.primary} wrap="truncate">
    {' '}
    ←
  </Text>
);
