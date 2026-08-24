/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createTwoFilesPatch } from 'diff';
import type {
  ToolCallView,
  ToolResult,
  ToolResultView,
  ToolRuntime,
} from '@deepseek-ai/dsh-tools';
import type { ConversationToolPresentation } from '../ui/conversation-runtime.js';
import type { ToolResultDisplay } from '../ui/tool-result.js';
import { projectDshContent } from './content-projector.js';
import type { DshToolPresenter } from './projector.js';

const TODO_WRITE_TOOL_NAME = 'todo_write';

interface TodoSummary {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
}

function parseArguments(argumentsJson: string): unknown | undefined {
  try {
    return JSON.parse(argumentsJson);
  } catch {
    return undefined;
  }
}

function formatInput(value: unknown): string {
  return typeof value === 'string'
    ? value
    : JSON.stringify(value, null, 2) ?? String(value);
}

function todoSummary(value: unknown): TodoSummary | undefined {
  if (typeof value !== 'object' || value === null || !('todos' in value)) {
    return undefined;
  }
  const todos = (value as { todos?: unknown }).todos;
  if (!Array.isArray(todos)) return undefined;
  return {
    completed: todos.filter(
      (todo) =>
        typeof todo === 'object' &&
        todo !== null &&
        'status' in todo &&
        todo.status === 'completed',
    ).length,
    inProgress: todos.filter(
      (todo) =>
        typeof todo === 'object' &&
        todo !== null &&
        'status' in todo &&
        todo.status === 'in_progress',
    ).length,
    pending: todos.filter(
      (todo) =>
        typeof todo === 'object' &&
        todo !== null &&
        'status' in todo &&
        todo.status === 'pending',
    ).length,
    total: todos.length,
  };
}

function diffDisplay(
  diffs: ReadonlyArray<{ path: string; oldText: string | null; newText: string }>,
): ToolResultDisplay | undefined {
  if (diffs.length === 0) return undefined;
  return {
    type: 'diff',
    content: {
      fileName: diffs.length === 1 ? diffs[0].path : `${String(diffs.length)} files`,
      fileDiff: diffs
        .map((diff) =>
          createTwoFilesPatch(
            diff.path,
            diff.path,
            diff.oldText ?? '',
            diff.newText,
            '',
            '',
          ),
        )
        .join('\n'),
    },
  };
}

function callPresentation(view: ToolCallView): ConversationToolPresentation {
  switch (view.card) {
    case 'terminal':
      return {
        kind: 'card',
        title: view.title,
        description: [view.description, view.cwd].filter(Boolean).join(' - '),
      };
    case 'diff':
      return {
        kind: 'card',
        title: view.title,
        resultDisplay: diffDisplay(view.diffs),
      };
    case 'generic':
      return {
        kind: 'card',
        title: view.title,
        ...(view.rawInput === undefined
          ? {}
          : { description: formatInput(view.rawInput) }),
        ...(view.content === undefined
          ? {}
          : {
              resultDisplay: {
                type: 'dsh-content',
                content: projectDshContent(view.content),
              },
            }),
      };
    default:
      throw new Error(`Unsupported DSH tool call card: ${String(view)}`);
  }
}

function resultDisplay(view: ToolResultView): ToolResultDisplay | undefined {
  switch (view.card) {
    case 'generic':
      return view.content === undefined
        ? undefined
        : { type: 'dsh-content', content: projectDshContent(view.content) };
    case 'terminal':
      return {
        type: 'terminal',
        ...(view.output === undefined ? {} : { output: view.output }),
        ...(view.exitCode === undefined ? {} : { exitCode: view.exitCode }),
        ...(view.signal === undefined ? {} : { signal: view.signal }),
      };
    case 'diff':
      return diffDisplay(view.diffs);
    case 'read':
      return {
        type: 'read',
        path: view.path,
        offset: view.offset,
        lines: view.lines,
        totalLines: view.totalLines,
        ...(view.lang === undefined ? {} : { lang: view.lang }),
      };
    case 'search':
      return view.shape === 'paths'
        ? {
            type: 'search-paths',
            paths: view.paths,
            truncated: view.truncated,
            total: view.total,
          }
        : {
            type: 'search-matches',
            files: view.files,
            truncated: view.truncated,
            total: view.total,
          };
    case 'web':
      return view.kind === 'search'
        ? {
            type: 'web-search',
            sources: view.sources,
            ...(view.answer === undefined ? {} : { answer: view.answer }),
            truncated: view.truncated,
          }
        : {
            type: 'web-fetch',
            url: view.url,
            statusCode: view.statusCode,
            truncated: view.truncated,
          };
    default:
      throw new Error(`Unsupported DSH tool result card: ${String(view)}`);
  }
}

function resultPresentation(view: ToolResultView): ConversationToolPresentation {
  return {
    kind: 'card',
    ...(view.title === undefined ? {} : { title: view.title }),
    ...(resultDisplay(view) === undefined
      ? {}
      : { resultDisplay: resultDisplay(view) }),
  };
}

export class DshToolPresentationAdapter implements DshToolPresenter {
  constructor(
    private readonly tools: Pick<ToolRuntime, 'get'>,
    private readonly scope?: Parameters<ToolRuntime['get']>[1],
  ) {}

  presentCall(name: string, argumentsJson: string): ConversationToolPresentation | undefined {
    const args = parseArguments(argumentsJson);
    if (args === undefined) return undefined;
    if (name === TODO_WRITE_TOOL_NAME && todoSummary(args) !== undefined) {
      return { kind: 'compact', label: 'Updating todo list...' };
    }
    try {
      const view = this.tools.get(name, this.scope)?.presentCall?.(args);
      return view === undefined ? undefined : callPresentation(view);
    } catch {
      return undefined;
    }
  }

  presentResult(
    name: string,
    argumentsJson: string,
    result: ToolResult,
  ): ConversationToolPresentation | undefined {
    const args = parseArguments(argumentsJson);
    if (args === undefined) return undefined;
    if (name === TODO_WRITE_TOOL_NAME) {
      if (result.isError) {
        return {
          kind: 'card',
          title: 'Update todo list',
          description: 'Todo update failed',
        };
      }
      const summary = todoSummary(args);
      if (summary !== undefined) {
        return {
          kind: 'compact',
          label:
            summary.total === 0
              ? 'Todo list cleared'
              : summary.completed === summary.total
                ? `Todo completed | ${String(summary.completed)}/${String(summary.total)}`
                : `Todo | ${String(summary.completed)} completed | ${String(summary.inProgress)} active | ${String(summary.pending)} pending`,
        };
      }
    }
    if (result.isError) return undefined;
    try {
      const view = this.tools.get(name, this.scope)?.presentResult?.(args, result);
      return view === undefined ? undefined : resultPresentation(view);
    } catch {
      return undefined;
    }
  }
}
