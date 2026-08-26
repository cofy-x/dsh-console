/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { formatTokenCount } from '../../utils/format-token-count.js';

const WARNING_PERCENT = 70;
const ERROR_PERCENT = 85;

export interface ContextUsageDisplayProps {
  promptTokens: number;
  contextWindow?: number;
  compact?: boolean;
}

export function ContextUsageDisplay({
  promptTokens,
  contextWindow,
  compact = false,
}: ContextUsageDisplayProps) {
  const validContextWindow =
    contextWindow !== undefined && contextWindow > 0
      ? contextWindow
      : undefined;
  if (promptTokens === 0 && validContextWindow === undefined) return null;

  const percent =
    validContextWindow === undefined
      ? undefined
      : (promptTokens / validContextWindow) * 100;
  const color =
    percent !== undefined && percent >= ERROR_PERCENT
      ? theme.status.error
      : percent !== undefined && percent >= WARNING_PERCENT
        ? theme.status.warning
        : theme.text.secondary;
  const percentage =
    compact || percent === undefined ? '' : ` (${Math.round(percent)}%)`;
  const usage = `${formatTokenCount(promptTokens)}/${
    validContextWindow === undefined ? '?' : formatTokenCount(validContextWindow)
  }`;

  return (
    <Box>
      <Text color={theme.text.secondary}> | </Text>
      <Text color={color}>
        {usage}
        {percentage}
      </Text>
    </Box>
  );
}
