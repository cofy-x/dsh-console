/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserQuestionOptionView {
  value: string;
  label: string;
  description?: string;
}

export interface UserQuestionView {
  id: string;
  question: string;
  header?: string;
  detail?: string;
  options?: readonly UserQuestionOptionView[];
  multiSelect: boolean;
  intent?: {
    kind: 'plan-review';
    approveValue: string;
  };
}

export interface UserQuestionRequestView {
  id: string;
  questions: readonly UserQuestionView[];
}

export interface UserQuestionAnswerView {
  id: string;
  selected: readonly string[];
  custom?: string;
}

export interface UserQuestionSnapshot {
  pending: readonly UserQuestionRequestView[];
}

export interface UserQuestionRuntime {
  getSnapshot(): UserQuestionSnapshot;
  subscribe(listener: () => void): () => void;
  answer(requestId: string, answers: readonly UserQuestionAnswerView[]): void;
  cancel(requestId: string): void;
}
