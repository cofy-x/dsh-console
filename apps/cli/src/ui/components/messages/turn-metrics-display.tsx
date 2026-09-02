/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import type { ConversationTurnMetrics } from '../../conversation-runtime.js';
import { formatMetricDuration, formatTokenRate } from '../../format-metrics.js';

interface TurnMetricsDisplayProps {
  metrics: ConversationTurnMetrics;
  terminalWidth: number;
}

export function TurnMetricsDisplay({
  metrics,
  terminalWidth,
}: TurnMetricsDisplayProps) {
  const parts = [`Turn ${formatMetricDuration(metrics.durationMs)}`];
  if (metrics.tokensPerSecond !== undefined) {
    parts.push(formatTokenRate(metrics.tokensPerSecond));
  }
  if (terminalWidth >= 80 && metrics.ttftMs !== undefined) {
    parts.push(`TTFT ${formatMetricDuration(metrics.ttftMs)}`);
  }
  return <Text dimColor>{parts.join(' · ')}</Text>;
}
