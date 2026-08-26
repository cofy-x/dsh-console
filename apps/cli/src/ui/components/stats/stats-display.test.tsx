/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, expect, it, vi } from 'vitest';
import { StatsDisplay } from './stats-display.js';
import * as SessionContext from '../../contexts/session-context.js';
import type { SessionMetrics } from '../../session-metrics.js';
import { useTerminalSize } from '../../hooks/terminal/use-terminal-size.js';

vi.mock('../../contexts/session-context.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SessionContext>();
  return { ...actual, useSessionStats: vi.fn() };
});
vi.mock('../../hooks/terminal/use-terminal-size.js', () => ({
  useTerminalSize: vi.fn(),
}));

const useSessionStatsMock = vi.mocked(SessionContext.useSessionStats);
const useTerminalSizeMock = vi.mocked(useTerminalSize);

const renderStats = (
  metrics: SessionMetrics,
  title?: string,
  context: {
    lastPromptTokenCount?: number;
    contextWindow?: number;
    terminalWidth?: number;
  } = {},
) => {
  const terminalWidth = context.terminalWidth ?? 120;
  useTerminalSizeMock.mockReturnValue({ columns: terminalWidth, rows: 40 });
  useSessionStatsMock.mockReturnValue({
    stats: {
      sessionId: 'test-session-id',
      sessionStartTime: new Date(),
      metrics,
      lastPromptTokenCount: context.lastPromptTokenCount ?? 0,
      ...(context.contextWindow === undefined
        ? {}
        : { contextWindow: context.contextWindow }),
      promptCount: 1,
    },
    getPromptCount: () => 1,
    startNewPrompt: vi.fn(),
  });
  return render(<StatsDisplay duration="1s" title={title} />, terminalWidth).lastFrame();
};

describe('<StatsDisplay />', () => {
  it('renders only metrics backed by canonical DSH events', () => {
    const output = renderStats({
      models: {
        'deepseek/deepseek-chat': {
          requests: 2,
          tokens: {
            inputTokens: 100,
            outputTokens: 30,
            cacheReadTokens: 40,
            cacheWriteTokens: 10,
            reasoningTokens: 5,
            totalTokens: 180,
          },
        },
      },
      tools: {
        totalCalls: 2,
        totalSuccess: 1,
        totalFail: 1,
        byName: { shell: { count: 2, success: 1, fail: 1 } },
      },
    }, undefined, { lastPromptTokenCount: 150, contextWindow: 1_000 });

    expect(output).toContain('Session Stats');
    expect(output).toContain('deepseek/deepseek-ch');
    expect(output).toContain('Cache Read:');
    expect(output).toContain('Cache Write');
    expect(output).toContain('150/1k (15%)');
    expect(output).toContain('180 total (150 prompt / 30 output)');
    expect(output).toContain('Reasoning tokens are included in Output');
    expect(output).toContain('26.7% of prompt tokens');
    expect(output).toContain('50.0%');
    expect(output).not.toContain('API Time');
    expect(output).not.toContain('Code Changes');
    expect(output).not.toContain('User Agreement');
  });

  it('uses a vertical model layout on narrow terminals', () => {
    const output = renderStats({
      models: {
        'deepseek/deepseek-chat': {
          requests: 2,
          tokens: {
            inputTokens: 100,
            outputTokens: 30,
            cacheReadTokens: 40,
            cacheWriteTokens: 10,
            reasoningTokens: 5,
            totalTokens: 180,
          },
        },
      },
      tools: {
        totalCalls: 0,
        totalSuccess: 0,
        totalFail: 0,
        byName: {},
      },
    }, undefined, { terminalWidth: 80 });

    expect(output).toContain('Input:');
    expect(output).toContain('Cache Read:');
    expect(output).toContain('Cache Write:');
    expect(output).toContain('Prompt Total:');
    expect(output).toContain('Total:');
  });

  it('renders an empty session without inventing model metrics', () => {
    const output = renderStats({
      models: {},
      tools: { totalCalls: 0, totalSuccess: 0, totalFail: 0, byName: {} },
    });

    expect(output).toContain('test-session-id');
    expect(output).toContain('Wall Time:');
    expect(output).not.toContain('Model Usage');
  });

  it('supports the quit summary title', () => {
    const output = renderStats(
      {
        models: {},
        tools: { totalCalls: 0, totalSuccess: 0, totalFail: 0, byName: {} },
      },
      'Agent powering down. Goodbye!',
    );
    expect(output).toContain('Agent powering down. Goodbye!');
    expect(output).not.toContain('Session Stats');
  });
});
