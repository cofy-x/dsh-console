/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
import type {
  UserQuestionAnswerView,
  UserQuestionView,
} from '../../user-question-runtime.js';
import { QuestionType, type Question } from '../../question.js';
import { AskUserDialog } from './ask-user-dialog.js';

export interface PlanReviewDialogProps {
  question: UserQuestionView;
  onSubmit(answer: UserQuestionAnswerView): void;
  onCancel(): void;
}

export function PlanReviewDialog({
  question,
  onSubmit,
  onCancel,
}: PlanReviewDialogProps): React.JSX.Element {
  const approveValue =
    question.intent?.kind === 'plan-review'
      ? question.intent.approveValue
      : undefined;
  const presented = useMemo<Question>(
    () => ({
      id: question.id,
      header: question.header ?? 'Plan Review',
      question: question.question,
      ...(question.detail === undefined ? {} : { detail: question.detail }),
      type: QuestionType.CHOICE,
      ...(question.options === undefined
        ? {}
        : {
            options: question.options.map((option) => ({
              value: option.value,
              label: option.label,
              description:
                option.description ??
                (option.value === approveValue
                  ? 'Approve this plan and continue.'
                  : ''),
            })),
          }),
      multiSelect: false,
      ...(approveValue === undefined ? {} : { preferredValue: approveValue }),
    }),
    [question, approveValue],
  );
  const presentedQuestions = useMemo(() => [presented], [presented]);
  const handleSubmit = useCallback(
    (
      answers: Record<string, { selected: readonly string[]; custom?: string }>,
    ) => {
      const answer = answers[0] ?? { selected: [] };
      onSubmit({
        id: question.id,
        selected: answer.selected,
        ...(answer.custom === undefined ? {} : { custom: answer.custom }),
      });
    },
    [onSubmit, question.id],
  );

  return (
    <AskUserDialog
      questions={presentedQuestions}
      presentation="plan-review"
      onCancel={onCancel}
      onSubmit={handleSubmit}
    />
  );
}
