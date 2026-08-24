/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  AskUserQuestionRequest,
  UserQuestionProvider,
  UserQuestionService,
} from '@deepseek-ai/dsh-user-questions';
import { describe, expect, it, vi } from 'vitest';
import { DshUserQuestionRuntime } from './user-question-runtime.js';

function setup() {
  const activeAgent = {} as Agent;
  let provider: UserQuestionProvider | undefined;
  const unregister = vi.fn();
  const service = {
    registerProvider: vi.fn((value: UserQuestionProvider) => {
      provider = value;
      return unregister;
    }),
  } satisfies Pick<UserQuestionService, 'registerProvider'>;
  const runtime = new DshUserQuestionRuntime(
    service,
    (agent) => agent === activeAgent,
  );
  return { activeAgent, provider: () => provider!, runtime, unregister };
}

describe('DshUserQuestionRuntime', () => {
  it('preserves canonical ids and option values while sanitizing labels', async () => {
    const { activeAgent, provider, runtime } = setup();
    const option = '\u001b[31mKeep canonical\u001b[0m';
    const answer = provider().ask({
      agent: activeAgent,
      questions: [
        {
          id: 'decision/original',
          question: 'Choose',
          options: [{ label: option }],
        },
      ],
    });

    const request = runtime.getSnapshot().pending[0];
    expect(request.questions[0].id).toBe('decision/original');
    expect(request.questions[0].options?.[0]).toEqual({
      value: option,
      label: 'Keep canonical',
    });

    runtime.answer(request.id, [
      { id: 'decision/original', selected: [option] },
    ]);
    await expect(answer).resolves.toEqual({
      answers: [{ id: 'decision/original', selected: [option] }],
    });
  });

  it('rejects an aborted request and removes it from the queue', async () => {
    const { activeAgent, provider, runtime } = setup();
    const controller = new AbortController();
    const answer = provider().ask({
      agent: activeAgent,
      signal: controller.signal,
      questions: [{ id: 'name', question: 'Name?' }],
    });

    controller.abort();

    await expect(answer).rejects.toMatchObject({ code: 'ASK_ABORTED' });
    expect(runtime.getSnapshot().pending).toEqual([]);
  });

  it('rejects questions from a non-active Agent', async () => {
    const { provider } = setup();
    const request = {
      agent: {} as Agent,
      questions: [{ id: 'foreign', question: 'Continue?' }],
    } satisfies AskUserQuestionRequest;

    await expect(provider().ask(request)).rejects.toMatchObject({
      code: 'CALLER_NOT_LIVE',
    });
  });

  it('unregisters and rejects pending questions on dispose', async () => {
    const { activeAgent, provider, runtime, unregister } = setup();
    const answer = provider().ask({
      agent: activeAgent,
      questions: [{ id: 'pending', question: 'Continue?' }],
    });

    runtime.dispose();

    await expect(answer).rejects.toMatchObject({ code: 'NO_PROVIDER' });
    expect(unregister).toHaveBeenCalledOnce();
  });
});
