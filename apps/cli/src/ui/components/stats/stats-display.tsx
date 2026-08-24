/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { ThemedGradient } from '../shared/themed-gradient.js';
import { theme } from '../../theme/colors.js';
import type { ModelMetrics } from '../../session-metrics.js';
import { useSessionStats } from '../../contexts/session-context.js';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
  CACHE_EFFICIENCY_HIGH,
  CACHE_EFFICIENCY_MEDIUM,
} from '../../theme/status-helpers.js';
import { computeSessionStats } from '../../state/session-stats.js';

const StatRow: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Box>
    <Box width={22}>
      <Text color={theme.text.link}>{title}</Text>
    </Box>
    {children}
  </Box>
);

const ModelUsageTable: React.FC<{
  models: Record<string, ModelMetrics>;
  cacheEfficiency: number;
  totalCacheReadTokens: number;
}> = ({ models, cacheEfficiency, totalCacheReadTokens }) => {
  const rows = Object.entries(models);
  if (rows.length === 0) return null;

  const cacheColor = getStatusColor(cacheEfficiency, {
    green: CACHE_EFFICIENCY_HIGH,
    yellow: CACHE_EFFICIENCY_MEDIUM,
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={theme.text.primary}>Model Usage</Text>
      <Box>
        <Box width={25}><Text bold>Model</Text></Box>
        <Box width={7} justifyContent="flex-end"><Text bold>Reqs</Text></Box>
        <Box width={12} justifyContent="flex-end"><Text bold>Input</Text></Box>
        <Box width={15} justifyContent="flex-end"><Text bold>Cache R/W</Text></Box>
        <Box width={12} justifyContent="flex-end"><Text bold>Output</Text></Box>
        <Box width={12} justifyContent="flex-end"><Text bold>Reasoning</Text></Box>
      </Box>
      {rows.map(([name, metrics]) => (
        <Box key={name}>
          <Box width={25}><Text wrap="truncate-end">{name}</Text></Box>
          <Box width={7} justifyContent="flex-end"><Text>{metrics.requests}</Text></Box>
          <Box width={12} justifyContent="flex-end"><Text>{metrics.tokens.inputTokens.toLocaleString()}</Text></Box>
          <Box width={15} justifyContent="flex-end"><Text>{metrics.tokens.cacheReadTokens.toLocaleString()} / {metrics.tokens.cacheWriteTokens.toLocaleString()}</Text></Box>
          <Box width={12} justifyContent="flex-end"><Text>{metrics.tokens.outputTokens.toLocaleString()}</Text></Box>
          <Box width={12} justifyContent="flex-end"><Text>{metrics.tokens.reasoningTokens.toLocaleString()}</Text></Box>
        </Box>
      ))}
      {totalCacheReadTokens > 0 && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Cache reads: {totalCacheReadTokens.toLocaleString()} tokens ({' '}
            <Text color={cacheColor}>{cacheEfficiency.toFixed(1)}%</Text> of prompt tokens)
          </Text>
        </Box>
      )}
    </Box>
  );
};

interface StatsDisplayProps {
  duration: string;
  title?: string;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({ duration, title }) => {
  const { stats } = useSessionStats();
  const { models, tools } = stats.metrics;
  const computed = computeSessionStats(stats.metrics);
  const successColor = getStatusColor(computed.successRate, {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  });

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      paddingY={1}
      paddingX={2}
      overflow="hidden"
    >
      {title ? (
        <ThemedGradient bold>{title}</ThemedGradient>
      ) : (
        <Text bold color={theme.text.accent}>Session Stats</Text>
      )}
      <Box height={1} />
      <StatRow title="Session ID:"><Text>{stats.sessionId}</Text></StatRow>
      <StatRow title="Wall Time:"><Text>{duration}</Text></StatRow>
      <StatRow title="Tool Calls:">
        <Text>
          {tools.totalCalls} (<Text color={theme.status.success}>✓ {tools.totalSuccess}</Text>{' '}
          <Text color={theme.status.error}>x {tools.totalFail}</Text>)
        </Text>
      </StatRow>
      {tools.totalCalls > 0 && (
        <StatRow title="Tool Success Rate:">
          <Text color={successColor}>{computed.successRate.toFixed(1)}%</Text>
        </StatRow>
      )}
      <ModelUsageTable
        models={models}
        cacheEfficiency={computed.cacheEfficiency}
        totalCacheReadTokens={computed.totalCacheReadTokens}
      />
    </Box>
  );
};
