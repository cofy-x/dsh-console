/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import { useUserQuestionRuntime } from '../../contexts/user-question-context.js';
import type { UserQuestionView } from '../../user-question-runtime.js';
import { QuestionType, type Question } from '../../question.js';
import { AskUserDialog } from './ask-user-dialog.js';
import { PlanReviewDialog } from './plan-review-dialog.js';

function isPlanReview(question: UserQuestionView): boolean {
  return (
    question.intent?.kind === 'plan-review' &&
    question.detail !== undefined &&
    question.multiSelect === false &&
    question.options?.some(
      (option) => option.value === question.intent?.approveValue,
    ) === true
  );
}

export const UserQuestionQueue: React.FC = () => {
  const { runtime, snapshot } = useUserQuestionRuntime();
  const request = snapshot.pending[0];
  const questions = useMemo<readonly Question[]>(
    () =>
      request?.questions.map((question) => ({
        id: question.id,
        question: question.question,
        header: question.header ?? 'Question',
        ...(question.detail === undefined ? {} : { detail: question.detail }),
        type:
          question.options === undefined || question.options.length === 0
            ? QuestionType.TEXT
            : QuestionType.CHOICE,
        ...(question.options === undefined
          ? {}
          : {
              options: question.options.map((option) => ({
                value: option.value,
                label: option.label,
                description: option.description ?? '',
              })),
            }),
        multiSelect: question.multiSelect,
      })) ?? [],
    [request],
  );

  if (request === undefined) return null;

  const planReview =
    request.questions.length === 1 && isPlanReview(request.questions[0])
      ? request.questions[0]
      : undefined;
  if (planReview !== undefined) {
    return (
      <PlanReviewDialog
        key={request.id}
        question={planReview}
        onCancel={() => runtime.cancel(request.id)}
        onSubmit={(answer) => runtime.answer(request.id, [answer])}
      />
    );
  }

  return (
    <AskUserDialog
      key={request.id}
      questions={[...questions]}
      onCancel={() => runtime.cancel(request.id)}
      onSubmit={(answers) => {
        runtime.answer(
          request.id,
          request.questions.map((question, index) => {
            const answer = answers[index] ?? { selected: [] };
            return {
              id: question.id,
              selected: answer.selected,
              ...(answer.custom === undefined ? {} : { custom: answer.custom }),
            };
          }),
        );
      }}
    />
  );
};
