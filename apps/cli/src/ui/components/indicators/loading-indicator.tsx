/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { useStreamingContext } from '../../contexts/streaming-context.js';
import { StreamingState } from '../../types.js';
import { AgentRespondingSpinner } from './agent-responding-spinner.js';
import { useTerminalSize } from '../../hooks/terminal/use-terminal-size.js';
import { formatDuration } from '../../../text/formatting.js';
import { isNarrowWidth } from '../../theme/layout.js';

interface LoadingIndicatorProps {
  currentLoadingPhrase?: string;
  elapsedTime: number;
  rightContent?: React.ReactNode;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  currentLoadingPhrase,
  elapsedTime,
  rightContent,
}) => {
  const streamingState = useStreamingContext();
  const { columns: terminalWidth } = useTerminalSize();
  const isNarrow = isNarrowWidth(terminalWidth);

  if (streamingState === StreamingState.Idle) {
    return null;
  }

  const primaryText = currentLoadingPhrase;

  const cancelAndTimerContent = `(esc to cancel, ${
    elapsedTime < 60 ? `${elapsedTime}s` : formatDuration(elapsedTime * 1000)
  })`;

  return (
    <Box paddingLeft={0} flexDirection="column">
      {/* Main loading line */}
      <Box
        width="100%"
        flexDirection={isNarrow ? 'column' : 'row'}
        alignItems={isNarrow ? 'flex-start' : 'center'}
      >
        <Box>
          <Box marginRight={1}>
            <AgentRespondingSpinner nonRespondingDisplay="" />
          </Box>
          {primaryText && (
            <Text color={theme.text.accent} wrap="truncate-end">
              {primaryText}
            </Text>
          )}
          {!isNarrow && cancelAndTimerContent && (
            <>
              <Box flexShrink={0} width={1} />
              <Text color={theme.text.secondary}>{cancelAndTimerContent}</Text>
            </>
          )}
        </Box>
        {!isNarrow && <Box flexGrow={1}>{/* Spacer */}</Box>}
        {!isNarrow && rightContent && <Box>{rightContent}</Box>}
      </Box>
      {isNarrow && cancelAndTimerContent && (
        <Box>
          <Text color={theme.text.secondary}>{cancelAndTimerContent}</Text>
        </Box>
      )}
      {isNarrow && rightContent && <Box>{rightContent}</Box>}
    </Box>
  );
};
