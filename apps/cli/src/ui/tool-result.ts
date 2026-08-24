/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnsiOutput } from '@cofy-x/dsh-console-core';
import type { ConversationContentBlock } from './conversation-runtime.js';

export type { AnsiOutput };

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Todo {
  description: string;
  status: TodoStatus;
}

export interface TodoList {
  todos: Todo[];
}

export type ToolResultDisplay =
  | { type: 'text'; content: string }
  | {
      type: 'dsh-content';
      content: readonly ConversationContentBlock[];
      error?: { name: string; code: string };
    }
  | { type: 'terminal'; output?: string; exitCode?: number; signal?: string }
  | { type: 'read'; path: string; offset: number; lines: ReadonlyArray<{ number: number; text: string }>; totalLines: number; lang?: string }
  | { type: 'search-paths'; paths: readonly string[]; truncated: boolean; total: number }
  | { type: 'search-matches'; files: ReadonlyArray<{ path: string; matches: ReadonlyArray<{ lineNumber: number; line: string }> }>; truncated: boolean; total: number }
  | { type: 'web-search'; sources: ReadonlyArray<{ url: string; title?: string; snippet?: string; publishedAt?: string }>; answer?: string; truncated: boolean }
  | { type: 'web-fetch'; url: string; statusCode: number; truncated: boolean }
  | { type: 'ansi'; content: AnsiOutput }
  | {
      type: 'diff';
      content: {
        fileDiff: string;
        fileName: string;
      };
    }
  | { type: 'todo'; content: TodoList };
