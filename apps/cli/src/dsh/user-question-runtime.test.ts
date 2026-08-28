/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  AskUserQuestionAnswer,
  AskUserQuestionRequest,
  UserQuestionService,
} from '@deepseek-ai/dsh-user-questions';
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
    | ((request: AskUserQuestionRequest) => Promise<AskUserQuestionAnswer>)
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

  it('rejects questions from a non-active Agent', async () => {
    const { answerer } = setup();
    const request = {
      agent: {} as Agent,
      questions: [{ id: 'foreign', question: 'Continue?' }],
    } satisfies AskUserQuestionRequest;

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
  it('uses the published provider contract when it is available', async () => {
    let provider:
      | { ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer> }
      | undefined;
    const unregister = vi.fn();
    const service = {
      registerProvider: vi.fn((value) => {
        provider = value;
        return unregister;
      }),
    } as unknown as UserQuestionService;
    const registerEventListener = vi.fn();
    const answerer = vi.fn(async () => ({ answers: [] }));

    const dispose = createUserQuestionAnswererRegistration(
      service,
      registerEventListener,
      () => true,
    )(answerer);
    const request = { questions: [] } satisfies AskUserQuestionRequest;

    await expect(provider!.ask(request)).resolves.toEqual({ answers: [] });
    expect(answerer).toHaveBeenCalledWith(request);
    expect(registerEventListener).not.toHaveBeenCalled();
    dispose();
    expect(unregister).toHaveBeenCalledOnce();
  });

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
      {} as UserQuestionService,
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
