/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { AskUserQuestionAnswer } from '@deepseek-ai/dsh-user-questions';
import type { AskUserQuestionRequestEvent } from '@deepseek-ai/dsh-user-questions/types';
import { describe, expect, it, vi } from 'vitest';
import {
  createUserQuestionAnswererRegistration,
  DshUserQuestionRuntime,
  type RegisterUserQuestionAnswerer,
  type UserQuestionEventListener,
} from './user-question-runtime.js';

function setup() {
  const activeAgent = {} as Agent;
  let answerer:
    | ((request: AskUserQuestionRequestEvent) => Promise<AskUserQuestionAnswer>)
    | undefined;
  const unregister = vi.fn();
  const registerAnswerer = vi.fn<RegisterUserQuestionAnswerer>((value) => {
    answerer = value;
    return unregister;
  });
  const runtime = new DshUserQuestionRuntime(
    registerAnswerer,
    (agent) => agent === activeAgent,
  );
  return { activeAgent, answerer: () => answerer!, runtime, unregister };
}

describe('DshUserQuestionRuntime', () => {
  it('preserves canonical ids and option values while sanitizing labels', async () => {
    const { activeAgent, answerer, runtime } = setup();
    const option = '\u001b[31mKeep canonical\u001b[0m';
    const answer = answerer()({
      agent: activeAgent,
      questions: [
        {
          id: 'decision/original',
          question: 'Choose',
          detail: '## Safe plan\n\n- Keep line structure',
          options: [{ label: option }],
          intent: { kind: 'plan-review', approve: option },
        },
      ],
    });

    const request = runtime.getSnapshot().pending[0];
    expect(request.questions[0].id).toBe('decision/original');
    expect(request.questions[0].options?.[0]).toEqual({
      value: option,
      label: 'Keep canonical',
    });
    expect(request.questions[0].intent).toEqual({
      kind: 'plan-review',
      approveValue: option,
    });
    expect(request.questions[0].detail).toBe(
      '## Safe plan\n\n- Keep line structure',
    );

    runtime.answer(request.id, [
      { id: 'decision/original', selected: [option] },
    ]);
    await expect(answer).resolves.toEqual({
      answers: [{ id: 'decision/original', selected: [option] }],
    });
  });

  it('rejects an aborted request and removes it from the queue', async () => {
    const { activeAgent, answerer, runtime } = setup();
    const controller = new AbortController();
    const answer = answerer()({
      agent: activeAgent,
      signal: controller.signal,
      questions: [{ id: 'name', question: 'Name?' }],
    });

    controller.abort();

    await expect(answer).rejects.toMatchObject({ code: 'ASK_ABORTED' });
    expect(runtime.getSnapshot().pending).toEqual([]);
  });

  it('rejects a free-text answer to a fixed DSH approval', async () => {
    const { activeAgent, answerer, runtime } = setup();
    const answer = answerer()({
      agent: activeAgent,
      questions: [
        {
          id: 'permission',
          question: 'Grant access?',
          detail: 'Read the selected folder.',
          options: [{ label: 'approve' }, { label: 'reject' }],
          intent: { kind: 'approval', approve: 'approve', reject: 'reject' },
        },
      ],
    });

    runtime.answer(runtime.getSnapshot().pending[0].id, [
      { id: 'permission', selected: ['approve'], custom: 'other' },
    ]);

    await expect(answer).rejects.toMatchObject({ code: 'BAD_ANSWER' });
    expect(runtime.getSnapshot().pending).toEqual([]);
  });

  it('rejects questions from a non-active Agent', async () => {
    const { answerer } = setup();
    const request = {
      agent: {} as Agent,
      questions: [{ id: 'foreign', question: 'Continue?' }],
    } satisfies AskUserQuestionRequestEvent;

    await expect(answerer()(request)).rejects.toMatchObject({
      code: 'CALLER_NOT_LIVE',
    });
  });

  it('unregisters and rejects pending questions on dispose', async () => {
    const { activeAgent, answerer, runtime, unregister } = setup();
    const answer = answerer()({
      agent: activeAgent,
      questions: [{ id: 'pending', question: 'Continue?' }],
    });

    runtime.dispose();

    await expect(answer).rejects.toMatchObject({ code: 'NO_PROVIDER' });
    expect(unregister).toHaveBeenCalledOnce();
  });
});

describe('createUserQuestionAnswererRegistration', () => {
  it('claims current-Agent waterfall requests and delegates other Agents', async () => {
    const activeAgent = {} as Agent;
    let listener: UserQuestionEventListener | undefined;
    const unregister = vi.fn();
    const registerEventListener = vi.fn((value: UserQuestionEventListener) => {
      listener = value;
      return unregister;
    });
    const answerer = vi.fn(async () => ({ answers: [] }));
    const next = vi.fn(async () => ({
      answers: [{ id: 'delegated', selected: ['yes'] }],
    }));

    const dispose = createUserQuestionAnswererRegistration(
      registerEventListener,
      (agent) => agent === activeAgent,
    )(answerer);

    await expect(
      listener!({ agent: activeAgent, questions: [] }, next),
    ).resolves.toEqual({ answers: [] });
    await expect(
      listener!({ agent: {} as Agent, questions: [] }, next),
    ).resolves.toEqual({
      answers: [{ id: 'delegated', selected: ['yes'] }],
    });
    expect(answerer).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    dispose();
    expect(unregister).toHaveBeenCalledOnce();
  });
});
