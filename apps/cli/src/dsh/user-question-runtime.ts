/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import {
  UserQuestionError,
  type AskUserQuestionAnswer,
} from '@deepseek-ai/dsh-user-questions';
import type { AskUserQuestionRequestEvent } from '@deepseek-ai/dsh-user-questions/types';
import {
  sanitizeForDisplay,
  sanitizeMultilineForDisplay,
} from '../text/processing.js';
import type {
  UserQuestionAnswerView,
  UserQuestionRequestView,
  UserQuestionRuntime,
  UserQuestionSnapshot,
} from '../ui/user-question-runtime.js';

interface PendingQuestion {
  view: UserQuestionRequestView;
  resolve(answer: AskUserQuestionAnswer): void;
  reject(error: Error): void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

export type RegisterUserQuestionAnswerer = (
  answerer: (
    request: AskUserQuestionRequestEvent,
  ) => Promise<AskUserQuestionAnswer>,
) => () => void;

export type UserQuestionEventListener = (
  request: AskUserQuestionRequestEvent,
  next: () => Promise<AskUserQuestionAnswer>,
) => Promise<AskUserQuestionAnswer>;

export type RegisterUserQuestionEventListener = (
  listener: UserQuestionEventListener,
) => () => void;

export function createUserQuestionAnswererRegistration(
  registerEventListener: RegisterUserQuestionEventListener,
  ownsAgent: (agent: Agent) => boolean,
): RegisterUserQuestionAnswerer {
  return (answerer) =>
    registerEventListener((request, next) => {
      if (request.agent !== undefined && !ownsAgent(request.agent)) {
        return next();
      }
      return answerer(request);
    });
}

export class DshUserQuestionRuntime implements UserQuestionRuntime {
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<string, PendingQuestion>();
  private snapshot: UserQuestionSnapshot = Object.freeze({ pending: [] });
  private sequence = 0;
  private disposed = false;
  private readonly unregister: () => void;

  constructor(
    registerAnswerer: RegisterUserQuestionAnswerer,
    private readonly ownsAgent: (agent: Agent) => boolean,
  ) {
    this.unregister = registerAnswerer((request) => this.ask(request));
  }

  getSnapshot = (): UserQuestionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async ask(
    request: AskUserQuestionRequestEvent,
  ): Promise<AskUserQuestionAnswer> {
    if (this.disposed) {
      throw new UserQuestionError(
        'dsh-console user interaction is unavailable',
        'NO_PROVIDER',
      );
    }
    if (request.agent !== undefined && !this.ownsAgent(request.agent)) {
      throw new UserQuestionError(
        'the question does not belong to the active dsh-console Agent',
        'CALLER_NOT_LIVE',
      );
    }
    if (request.signal?.aborted) {
      throw new UserQuestionError(
        'ask_user_question was aborted before the user answered',
        'ASK_ABORTED',
      );
    }

    const id = `dsh-question-${++this.sequence}`;
    const view: UserQuestionRequestView = Object.freeze({
      id,
      questions: Object.freeze(
        request.questions.map((question) =>
          Object.freeze({
            id: question.id,
            question: sanitizeForDisplay(question.question, 2000),
            ...(question.header === undefined
              ? {}
              : { header: sanitizeForDisplay(question.header, 160) }),
            ...(question.detail === undefined
              ? {}
              : {
                  detail: sanitizeMultilineForDisplay(question.detail, 20_000),
                }),
            ...(question.options === undefined
              ? {}
              : {
                  options: Object.freeze(
                    question.options.map((option) =>
                      Object.freeze({
                        value: option.label,
                        label: sanitizeForDisplay(option.label, 500),
                        ...(option.description === undefined
                          ? {}
                          : {
                              description: sanitizeForDisplay(
                                option.description,
                                2000,
                              ),
                            }),
                      }),
                    ),
                  ),
                }),
            multiSelect: question.multiSelect === true,
            ...(question.intent?.kind === 'plan-review'
              ? {
                  intent: Object.freeze({
                    kind: 'plan-review' as const,
                    approveValue: question.intent.approve,
                  }),
                }
              : question.intent?.kind === 'approval'
                ? {
                    intent: Object.freeze({
                      kind: 'approval' as const,
                      rejectValue: question.intent.reject,
                    }),
                  }
                : {}),
          }),
        ),
      ),
    });

    return new Promise<AskUserQuestionAnswer>((resolve, reject) => {
      const pending: PendingQuestion = {
        view,
        resolve,
        reject,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      };
      if (request.signal !== undefined) {
        pending.onAbort = () => this.reject(id, 'ASK_ABORTED');
        request.signal.addEventListener('abort', pending.onAbort, {
          once: true,
        });
      }
      this.pending.set(id, pending);
      this.publish();
    });
  }

  answer(requestId: string, answers: readonly UserQuestionAnswerView[]): void {
    const pending = this.take(requestId);
    if (pending === undefined) return;
    const question = pending.view.questions[0];
    const answer = answers[0];
    if (
      question?.intent?.kind === 'approval' &&
      (answers.length !== 1 ||
        answer?.id !== question.id ||
        answer.custom !== undefined ||
        answer.selected.length !== 1 ||
        !question.options?.some(
          (option) => option.value === answer.selected[0],
        ))
    ) {
      pending.reject(
        new UserQuestionError(
          'Select one of the offered approval actions.',
          'BAD_ANSWER',
        ),
      );
      return;
    }
    pending.resolve({
      answers: answers.map((answer) => ({
        id: answer.id,
        selected: [...answer.selected],
        ...(answer.custom === undefined ? {} : { custom: answer.custom }),
      })),
    });
  }

  cancel(requestId: string): void {
    this.reject(requestId, 'ASK_ABORTED');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unregister();
    for (const id of [...this.pending.keys()]) this.reject(id, 'NO_PROVIDER');
    this.listeners.clear();
  }

  private reject(id: string, code: 'ASK_ABORTED' | 'NO_PROVIDER'): void {
    const pending = this.take(id);
    if (pending === undefined) return;
    pending.reject(
      new UserQuestionError(
        code === 'ASK_ABORTED'
          ? 'ask_user_question was cancelled before the user answered'
          : 'dsh-console user interaction is unavailable',
        code,
      ),
    );
  }

  private take(id: string): PendingQuestion | undefined {
    const pending = this.pending.get(id);
    if (pending === undefined) return undefined;
    this.pending.delete(id);
    if (pending.signal !== undefined && pending.onAbort !== undefined) {
      pending.signal.removeEventListener('abort', pending.onAbort);
    }
    this.publish();
    return pending;
  }

  private publish(): void {
    this.snapshot = Object.freeze({
      pending: Object.freeze(
        [...this.pending.values()].map((entry) => entry.view),
      ),
    });
    for (const listener of this.listeners) listener();
  }
}
