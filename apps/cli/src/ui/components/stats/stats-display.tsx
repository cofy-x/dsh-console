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
import { useTerminalSize } from '../../hooks/terminal/use-terminal-size.js';
import { formatTokenCount } from '../../utils/format-token-count.js';
import { formatMetricDuration, formatTokenRate } from '../../format-metrics.js';

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
  compact: boolean;
}> = ({ models, compact }) => {
  const rows = Object.entries(models);
  if (rows.length === 0) return null;

  if (compact) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.text.accent}>
            Model Usage
          </Text>
        </Box>
        {rows.map(([name, metrics], index) => {
          const promptTokens =
            metrics.tokens.inputTokens +
            metrics.tokens.cacheReadTokens +
            metrics.tokens.cacheWriteTokens;
          const totalTokens = metrics.tokens.totalTokens;
          return (
            <Box
              key={name}
              flexDirection="column"
              marginTop={index === 0 ? 0 : 1}
            >
              <Text bold color={theme.text.primary} wrap="wrap">
                {name}
              </Text>
              <StatRow title="Requests:">
                <Text>{metrics.requests}</Text>
              </StatRow>
              <StatRow title="Input:">
                <Text>{metrics.tokens.inputTokens.toLocaleString()}</Text>
              </StatRow>
              <StatRow title="Cache Read:">
                <Text>{metrics.tokens.cacheReadTokens.toLocaleString()}</Text>
              </StatRow>
              <StatRow title="Cache Write:">
                <Text>{metrics.tokens.cacheWriteTokens.toLocaleString()}</Text>
              </StatRow>
              <StatRow title="Prompt Total:">
                <Text>{promptTokens.toLocaleString()}</Text>
              </StatRow>
              <StatRow title="Output:">
                <Text>{metrics.tokens.outputTokens.toLocaleString()}</Text>
              </StatRow>
              <StatRow title="Reasoning:">
                <Text color={theme.text.accent}>
                  {metrics.tokens.reasoningTokens.toLocaleString()}
                </Text>
              </StatRow>
              <StatRow title="Total:">
                <Text bold>{totalTokens.toLocaleString()}</Text>
              </StatRow>
            </Box>
          );
        })}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Reasoning tokens are included in Output.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Model Usage
        </Text>
      </Box>
      <Box>
        <Box width={23}>
          <Text bold color={theme.text.link}>
            Model
          </Text>
        </Box>
        <Box width={9} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Requests
          </Text>
        </Box>
        <Box width={10} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Input
          </Text>
        </Box>
        <Box width={12} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Cache Read
          </Text>
        </Box>
        <Box width={13} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Cache Write
          </Text>
        </Box>
        <Box width={10} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Prompt
          </Text>
        </Box>
        <Box width={10} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Output
          </Text>
        </Box>
        <Box width={11} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Reasoning
          </Text>
        </Box>
        <Box width={10} justifyContent="flex-end">
          <Text bold color={theme.text.link}>
            Total
          </Text>
        </Box>
      </Box>
      {rows.map(([name, metrics]) => {
        const promptTokens =
          metrics.tokens.inputTokens +
          metrics.tokens.cacheReadTokens +
          metrics.tokens.cacheWriteTokens;
        const totalTokens = metrics.tokens.totalTokens;
        return (
          <Box key={name}>
            <Box width={23}>
              <Text bold color={theme.text.primary} wrap="truncate-end">
                {name}
              </Text>
            </Box>
            <Box width={9} justifyContent="flex-end">
              <Text>{metrics.requests}</Text>
            </Box>
            <Box width={10} justifyContent="flex-end">
              <Text>{metrics.tokens.inputTokens.toLocaleString()}</Text>
            </Box>
            <Box width={12} justifyContent="flex-end">
              <Text>{metrics.tokens.cacheReadTokens.toLocaleString()}</Text>
            </Box>
            <Box width={13} justifyContent="flex-end">
              <Text>{metrics.tokens.cacheWriteTokens.toLocaleString()}</Text>
            </Box>
            <Box width={10} justifyContent="flex-end">
              <Text>{promptTokens.toLocaleString()}</Text>
            </Box>
            <Box width={10} justifyContent="flex-end">
              <Text>{metrics.tokens.outputTokens.toLocaleString()}</Text>
            </Box>
            <Box width={11} justifyContent="flex-end">
              <Text color={theme.text.accent}>
                {metrics.tokens.reasoningTokens.toLocaleString()}
              </Text>
            </Box>
            <Box width={10} justifyContent="flex-end">
              <Text bold>{totalTokens.toLocaleString()}</Text>
            </Box>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Reasoning tokens are included in Output.
        </Text>
      </Box>
    </Box>
  );
};

interface StatsDisplayProps {
  duration: string;
  title?: string;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({
  duration,
  title,
}) => {
  const { stats } = useSessionStats();
  const { columns } = useTerminalSize();
  const { models, tools } = stats.metrics;
  const computed = computeSessionStats(stats.metrics);
  const successColor = getStatusColor(computed.successRate, {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  });
  const cacheColor = getStatusColor(computed.cacheEfficiency, {
    green: CACHE_EFFICIENCY_HIGH,
    yellow: CACHE_EFFICIENCY_MEDIUM,
  });
  const validContextWindow =
    stats.contextWindow !== undefined && stats.contextWindow > 0
      ? stats.contextWindow
      : undefined;
  const showLatestPrompt =
    stats.lastPromptTokenCount > 0 || validContextWindow !== undefined;
  const contextPercent =
    validContextWindow === undefined
      ? undefined
      : Math.round((stats.lastPromptTokenCount / validContextWindow) * 100);
  const latestPrompt = `${formatTokenCount(stats.lastPromptTokenCount)}/${
    validContextWindow === undefined
      ? '?'
      : formatTokenCount(validContextWindow)
  }${contextPercent === undefined ? '' : ` (${contextPercent}%)`}`;

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
        <Text bold color={theme.text.accent}>
          Session Stats
        </Text>
      )}
      <Box height={1} />
      <StatRow title="Session ID:">
        <Text>{stats.sessionId}</Text>
      </StatRow>
      <StatRow title="Wall Time:">
        <Text>{duration}</Text>
      </StatRow>
      {showLatestPrompt && (
        <StatRow title="Latest Prompt:">
          <Text>{latestPrompt}</Text>
        </StatRow>
      )}
      {stats.timing !== undefined && stats.timing.turns > 0 && (
        <>
          <StatRow title="Turns / Steps:">
            <Text>
              {stats.timing.turns} / {stats.timing.steps}
            </Text>
          </StatRow>
          <StatRow title="LLM Time:">
            <Text>{formatMetricDuration(stats.timing.llmMs)}</Text>
          </StatRow>
          <StatRow title="Tool Time:">
            <Text>{formatMetricDuration(stats.timing.toolMs)}</Text>
          </StatRow>
          {stats.timing.ttftSteps > 0 && (
            <StatRow title="Average TTFT:">
              <Text>
                {formatMetricDuration(
                  stats.timing.ttftMs / stats.timing.ttftSteps,
                )}
              </Text>
            </StatRow>
          )}
          {stats.timing.decodeMs > 0 && stats.timing.decodeTokens > 0 && (
            <StatRow title="Output Speed:">
              <Text>
                {formatTokenRate(
                  stats.timing.decodeTokens / (stats.timing.decodeMs / 1_000),
                )}
              </Text>
            </StatRow>
          )}
        </>
      )}
      <StatRow title="Session Tokens:">
        <Text>
          {computed.totalSessionTokens.toLocaleString()} total (
          {computed.totalPromptTokens.toLocaleString()} prompt /{' '}
          {computed.totalOutputTokens.toLocaleString()} output)
        </Text>
      </StatRow>
      {computed.totalCacheReadTokens > 0 && (
        <StatRow title="Cache Read:">
          <Text>
            {computed.totalCacheReadTokens.toLocaleString()} (
            <Text color={cacheColor}>
              {computed.cacheEfficiency.toFixed(1)}%
            </Text>{' '}
            of prompt tokens)
          </Text>
        </StatRow>
      )}
      <StatRow title="Tool Calls:">
        <Text>
          {tools.totalCalls} (
          <Text color={theme.status.success}>✓ {tools.totalSuccess}</Text>{' '}
          <Text color={theme.status.error}>x {tools.totalFail}</Text>)
        </Text>
      </StatRow>
      {tools.totalCalls > 0 && (
        <StatRow title="Tool Success Rate:">
          <Text color={successColor}>{computed.successRate.toFixed(1)}%</Text>
        </StatRow>
      )}
      <ModelUsageTable models={models} compact={columns < 120} />
    </Box>
  );
};
