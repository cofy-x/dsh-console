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

vi.mock('../../contexts/session-context.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SessionContext>();
  return { ...actual, useSessionStats: vi.fn() };
});

const useSessionStatsMock = vi.mocked(SessionContext.useSessionStats);

const renderStats = (metrics: SessionMetrics, title?: string) => {
  useSessionStatsMock.mockReturnValue({
    stats: {
      sessionId: 'test-session-id',
      sessionStartTime: new Date(),
      metrics,
      lastPromptTokenCount: 0,
      promptCount: 1,
    },
    getPromptCount: () => 1,
    startNewPrompt: vi.fn(),
  });
  return render(<StatsDisplay duration="1s" title={title} />).lastFrame();
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
            totalTokens: 185,
          },
        },
      },
      tools: {
        totalCalls: 2,
        totalSuccess: 1,
        totalFail: 1,
        byName: { shell: { count: 2, success: 1, fail: 1 } },
      },
    });

    expect(output).toContain('Session Stats');
    expect(output).toContain('deepseek/deepseek-chat');
    expect(output).toContain('40 / 10');
    expect(output).toContain('50.0%');
    expect(output).not.toContain('API Time');
    expect(output).not.toContain('Code Changes');
    expect(output).not.toContain('User Agreement');
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
