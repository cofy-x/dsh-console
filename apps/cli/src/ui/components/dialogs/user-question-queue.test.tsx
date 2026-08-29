/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '../../../test-utils/async.js';
import { renderWithProviders } from '../../../test-utils/render.js';
import { UserQuestionRuntimeProvider } from '../../contexts/user-question-context.js';
import type { UserQuestionRuntime } from '../../user-question-runtime.js';
import { UserQuestionQueue } from './user-question-queue.js';

function runtime(
  detail = '## Deployment plan\n\n- Run the focused tests\n- Ship safely',
) {
  const answer = vi.fn();
  const cancel = vi.fn();
  const approveValue = '\u001b[32mApprove plan\u001b[0m';
  const snapshot = {
    pending: [
      {
        id: 'request-1',
        questions: [
          {
            id: 'plan',
            header: 'Implementation',
            question: 'Ready to proceed?',
            detail,
            options: [
              {
                value: 'Reject plan',
                label: 'Reject plan',
                description: 'Do not continue.',
              },
              {
                value: approveValue,
                label: 'Approve plan',
              },
            ],
            multiSelect: false,
            intent: {
              kind: 'plan-review' as const,
              approveValue,
            },
          },
        ],
      },
    ],
  };
  const value: UserQuestionRuntime = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    answer,
    cancel,
  };
  return { answer, cancel, value };
}

describe('UserQuestionQueue plan review', () => {
  it('renders canonical plan detail as Markdown and submits approval', async () => {
    const questions = runtime();
    const view = renderWithProviders(
      <UserQuestionRuntimeProvider runtime={questions.value}>
        <UserQuestionQueue />
      </UserQuestionRuntimeProvider>,
      { width: 100 },
    );

    const frame = view.lastFrame();
    expect(frame).toContain('Plan Review');
    expect(frame).toContain('Deployment plan');
    expect(frame).toContain('Run the focused tests');
    expect(frame).toContain('Approve plan');
    expect(frame).toContain('Request changes...');
    expect(frame).not.toContain('## Deployment plan');
    expect(frame).toContain('PgUp/PgDn scroll plan');

    await act(async () => {
      view.stdin.write('\r');
      await Promise.resolve();
    });

    expect(questions.answer).toHaveBeenCalledWith('request-1', [
      { id: 'plan', selected: ['\u001b[32mApprove plan\u001b[0m'] },
    ]);
  });

  it('cancels the canonical request with Escape', async () => {
    const questions = runtime();
    const view = renderWithProviders(
      <UserQuestionRuntimeProvider runtime={questions.value}>
        <UserQuestionQueue />
      </UserQuestionRuntimeProvider>,
    );

    await act(async () => {
      view.stdin.write('\u001b[27u');
      await Promise.resolve();
    });

    expect(questions.cancel).toHaveBeenCalledWith('request-1');
    expect(questions.answer).not.toHaveBeenCalled();
  });

  it('keeps actions visible and scrolls a long Markdown plan', async () => {
    const detail = [
      '# Long plan',
      '',
      ...Array.from(
        { length: 30 },
        (_, index) => `- Step ${index + 1} ${'中文内容'.repeat(12)}`,
      ),
      '',
      'End of plan',
    ].join('\n');
    const questions = runtime(detail);
    const view = renderWithProviders(
      <UserQuestionRuntimeProvider runtime={questions.value}>
        <UserQuestionQueue />
      </UserQuestionRuntimeProvider>,
      { uiState: { terminalHeight: 20 }, width: 80 },
    );

    expect(view.lastFrame()).toContain('Approve plan');
    expect(view.lastFrame()).not.toContain('End of plan');

    await act(async () => {
      view.stdin.write('\u001b[6~');
    });
    await waitFor(() => {
      expect(view.lastFrame()).toContain('Step 2');
      expect(view.lastFrame()).not.toContain('Long plan');
    });

    await act(async () => {
      view.stdin.write('\u001b[1;5F');
    });
    await waitFor(() => {
      expect(view.lastFrame()).toContain('End of plan');
    });
  });
});
