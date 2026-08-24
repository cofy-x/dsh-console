/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect, vi } from 'vitest';
import { SessionSummaryDisplay } from './session-summary-display.js';
import * as SessionContext from '../../contexts/session-context.js';
import type { SessionMetrics } from '../../contexts/session-context.js';

vi.mock('../../contexts/session-context.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SessionContext>();
  return {
    ...actual,
    useSessionStats: vi.fn(),
  };
});

const useSessionStatsMock = vi.mocked(SessionContext.useSessionStats);

const renderWithMockedStats = (metrics: SessionMetrics) => {
  useSessionStatsMock.mockReturnValue({
    stats: {
      sessionId: 'test-session',
      sessionStartTime: new Date(),
      metrics,
      lastPromptTokenCount: 0,
      promptCount: 5,
    },

    getPromptCount: () => 5,
    startNewPrompt: vi.fn(),
  });

  return render(<SessionSummaryDisplay duration="1h 23m 45s" />);
};

describe('<SessionSummaryDisplay />', () => {
  it('renders the summary display with a title', () => {
    const metrics: SessionMetrics = {
      models: {
        'deepseek/deepseek-chat': {
          requests: 10,
          tokens: {
            inputTokens: 500,
            outputTokens: 2000,
            cacheReadTokens: 500,
            cacheWriteTokens: 0,
            reasoningTokens: 300,
            totalTokens: 3000,
          },
        },
      },
      tools: {
        totalCalls: 0,
        totalSuccess: 0,
        totalFail: 0,
        byName: {},
      },
    };

    const { lastFrame } = renderWithMockedStats(metrics);
    const output = lastFrame();

    expect(output).toContain('Agent powering down. Goodbye!');
    expect(output).toContain('deepseek/deepseek-chat');
    expect(output).not.toContain('API Time');
  });
});
