/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import type { IndividualToolCallDisplay } from '../../types.js';
import { ToolCallStatus } from '../../types.js';
import { ToolMessage } from './tool-message.js';
import { ShellToolMessage } from './shell-tool-message.js';
import { theme } from '../../theme/colors.js';
import { useConfig } from '../../contexts/config-context.js';
import {
  isShellTool,
  isThisShellFocused,
  ToolStatusIndicator,
} from './tool-shared.js';
import { ASK_USER_DISPLAY_NAME } from '../../question.js';
import { isToolResultCollapsible } from './tool-result-display.js';

interface ToolGroupMessageProps {
  groupId: number;
  toolCalls: IndividualToolCallDisplay[];
  availableTerminalHeight?: number;
  terminalWidth: number;
  isFocused?: boolean;
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  onShellInputSubmit?: (input: string) => void;
}

// Helper to identify Ask User tools that are in progress (have their own dialog UI)
const isAskUserInProgress = (t: IndividualToolCallDisplay): boolean =>
  t.name === ASK_USER_DISPLAY_NAME &&
  [ToolCallStatus.Pending, ToolCallStatus.Executing].includes(t.status);

// Main component renders the border and maps the tools using ToolMessage
export const ToolGroupMessage: React.FC<ToolGroupMessageProps> = ({
  toolCalls: allToolCalls,
  availableTerminalHeight,
  terminalWidth,
  activeShellPtyId,
  embeddedShellFocused,
}) => {
  // Filter out in-progress Ask User tools (they have their own AskUserDialog UI)
  const toolCalls = useMemo(
    () => allToolCalls.filter((t) => !isAskUserInProgress(t)),
    [allToolCalls],
  );

  const config = useConfig();

  // Pre-execution states are not rendered as completed Tool Cards.
  const visibleToolCalls = useMemo(() => toolCalls.filter((t) => t.status !== ToolCallStatus.Pending), [toolCalls]);

  const [expandedCallIds, setExpandedCallIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const resultWidth = Math.max(1, terminalWidth - 4);
  const collapsibleCallIds = useMemo(
    () =>
      visibleToolCalls
        .filter((tool) =>
          isToolResultCollapsible(tool.resultDisplay, resultWidth),
        )
        .map((tool) => tool.callId),
    [resultWidth, visibleToolCalls],
  );
  const toggleResult = useCallback((callId: string) => {
    setExpandedCallIds((current) => {
      const next = new Set(current);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  }, []);
  const isEmbeddedShellFocused = visibleToolCalls.some((t) =>
    isThisShellFocused(
      t.name,
      t.status,
      t.ptyId,
      activeShellPtyId,
      embeddedShellFocused,
    ),
  );

  const hasPending = !visibleToolCalls.every(
    (t) => t.status === ToolCallStatus.Success,
  );

  const isShellCommand = toolCalls.some((t) => isShellTool(t.name));
  const borderColor =
    (isShellCommand && hasPending) || isEmbeddedShellFocused
      ? theme.ui.symbol
      : hasPending
        ? theme.status.warning
        : theme.border.default;

  const borderDimColor =
    hasPending && (!isShellCommand || !isEmbeddedShellFocused);

  const cardRunCount = visibleToolCalls.reduce(
    (count, tool, index) =>
      tool.presentation?.kind !== 'compact' &&
      (index === 0 ||
        visibleToolCalls[index - 1]?.presentation?.kind === 'compact')
        ? count + 1
        : count,
    0,
  );
  const staticHeight =
    /* borders for each separated card run */
    cardRunCount * 2;
  const hasCompactToolCalls = visibleToolCalls.some(
    (tool) => tool.presentation?.kind === 'compact',
  );

  // If all tools are hidden because the group only contains pending tools,
  // render nothing in the history log.
  if (visibleToolCalls.length === 0) {
    return null;
  }

  let countToolCallsWithResults = 0;
  for (const tool of visibleToolCalls) {
    if (
      tool.presentation?.kind !== 'compact' &&
      tool.resultDisplay !== undefined
    ) {
      countToolCallsWithResults++;
    }
  }
  const countOneLineToolCalls =
    visibleToolCalls.length - countToolCallsWithResults;
  const availableTerminalHeightPerToolMessage = availableTerminalHeight
    ? Math.max(
        Math.floor(
          (availableTerminalHeight - staticHeight - countOneLineToolCalls) /
            Math.max(1, countToolCallsWithResults),
        ),
        1,
      )
    : undefined;

  return (
    // This box doesn't have a border even though it conceptually does because
    // we need to allow the sticky headers to render the borders themselves so
    // that the top border can be sticky.
    <Box
      flexDirection="column"
      /*
        This width constraint is highly important and protects us from an Ink rendering bug.
        Since the ToolGroup can typically change rendering states frequently, it can cause
        Ink to render the border of the box incorrectly and span multiple lines and even
        cause tearing.
      */
      width={terminalWidth}
    >
      {visibleToolCalls.map((tool, index) => {
        const isCompact = tool.presentation?.kind === 'compact';
        const previous = visibleToolCalls[index - 1];
        const next = visibleToolCalls[index + 1];
        const isFirst =
          index === 0 || previous?.presentation?.kind === 'compact';
        const isLastCardInRun =
          !isCompact &&
          (next === undefined || next.presentation?.kind === 'compact');
        const isShellToolCall = isShellTool(tool.name);

        const commonProps = {
          ...tool,
          availableTerminalHeight: availableTerminalHeightPerToolMessage,
          terminalWidth,
          emphasis: 'medium' as const,
          isFirst,
          borderColor,
          borderDimColor,
          resultCollapsible: collapsibleCallIds.includes(tool.callId),
          resultExpanded: expandedCallIds.has(tool.callId),
          onToggleResult: () => toggleResult(tool.callId),
        };

        return (
          <Box
            key={tool.callId}
            flexDirection="column"
            minHeight={1}
            width={terminalWidth}
          >
            {isCompact ? (
              <Box flexDirection="row" width={terminalWidth}>
                <ToolStatusIndicator status={tool.status} name={tool.name} />
                <Text color={theme.text.primary} wrap="truncate">
                  {tool.presentation?.label}
                </Text>
              </Box>
            ) : isShellToolCall ? (
              <ShellToolMessage
                {...commonProps}
                activeShellPtyId={activeShellPtyId}
                embeddedShellFocused={embeddedShellFocused}
                config={config}
              />
            ) : (
              <ToolMessage {...commonProps} />
            )}
            {!isCompact && (
              <Box
                borderLeft={true}
                borderRight={true}
                borderTop={false}
                borderBottom={false}
                borderColor={borderColor}
                borderDimColor={borderDimColor}
                flexDirection="column"
                borderStyle="round"
                paddingLeft={1}
                paddingRight={1}
              >
                {tool.outputFile && (
                  <Box>
                    <Text color={theme.text.primary}>
                      Output too long and was saved to: {tool.outputFile}
                    </Text>
                  </Box>
                )}
              </Box>
            )}
            {hasCompactToolCalls && isLastCardInRun && (
              <Box
                height={0}
                width={terminalWidth}
                borderLeft={true}
                borderRight={true}
                borderTop={false}
                borderBottom={true}
                borderColor={borderColor}
                borderDimColor={borderDimColor}
                borderStyle="round"
              />
            )}
          </Box>
        );
      })}
      {!hasCompactToolCalls && visibleToolCalls.length > 0 && (
        <Box
          height={0}
          width={terminalWidth}
          borderLeft={true}
          borderRight={true}
          borderTop={false}
          borderBottom={true}
          borderColor={borderColor}
          borderDimColor={borderDimColor}
          borderStyle="round"
        />
      )}
    </Box>
  );
};
