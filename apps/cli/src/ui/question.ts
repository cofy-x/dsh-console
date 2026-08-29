/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QuestionOption {
  value?: string;
  label: string;
  description: string;
}

export const ASK_USER_DISPLAY_NAME = 'Ask User';

export enum QuestionType {
  CHOICE = 'choice',
  TEXT = 'text',
  YESNO = 'yesno',
}

export interface Question {
  id?: string;
  question: string;
  header: string;
  detail?: string;
  type?: QuestionType;
  options?: QuestionOption[];
  multiSelect?: boolean;
  placeholder?: string;
  preferredValue?: string;
}
