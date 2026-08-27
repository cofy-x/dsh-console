/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import type { Todo, TodoList, TodoStatus } from '../../tool-result.js';
import { theme } from '../../theme/colors.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useMemo } from 'react';
import { StreamingState } from '../../types.js';

const TodoTitleDisplay: React.FC<{
  todos: TodoList;
  isWorking: boolean;
  compact?: boolean;
}> = ({ todos, isWorking, compact = false }) => {
  const score = useMemo(() => {
    let total = 0;
    let completed = 0;
    let unfinished = 0;
    for (const todo of todos.todos) {
      if (todo.status !== 'cancelled') {
        total += 1;
        if (todo.status === 'completed') {
          completed += 1;
        } else {
          unfinished += 1;
        }
      }
    }
    const idleRemainder = !isWorking && unfinished > 0
      ? ` · ${unfinished} unfinished`
      : '';
    const completion = compact
      ? `${completed}/${total}`
      : `${completed}/${total} completed`;
    return `${completion}${idleRemainder}`;
  }, [compact, isWorking, todos]);

  return (
    <Box flexDirection="row" columnGap={2} height={1}>
      <Text color={theme.text.primary} bold aria-label="Todo list">
        Todo
      </Text>
      <Text color={theme.text.secondary} wrap="truncate">
        {score} {compact ? '(ctrl+t)' : '(ctrl+t to toggle)'}
      </Text>
    </Box>
  );
};

const TodoStatusDisplay: React.FC<{
  status: TodoStatus;
  isWorking: boolean;
}> = ({ status, isWorking }) => {
  switch (status) {
    case 'completed':
      return (
        <Text color={theme.status.success} aria-label="Completed">
          ✓
        </Text>
      );
    case 'in_progress':
      if (!isWorking) {
        return (
          <Text color={theme.text.secondary} aria-label="Unfinished">
            ○
          </Text>
        );
      }
      return (
        <Text color={theme.text.accent} aria-label="In Progress">
          »
        </Text>
      );
    case 'pending':
      return (
        <Text color={theme.text.secondary} aria-label="Pending">
          ☐
        </Text>
      );
    case 'cancelled':
    default:
      return (
        <Text color={theme.status.error} aria-label="Cancelled">
          ✗
        </Text>
      );
  }
};

const TodoItemDisplay: React.FC<{
  todo: Todo;
  wrap?: 'truncate';
  role?: 'listitem';
  isWorking: boolean;
}> = ({ todo, wrap, role: ariaRole, isWorking }) => {
  const textColor = (() => {
    switch (todo.status) {
      case 'in_progress':
        return isWorking ? theme.text.accent : theme.text.primary;
      case 'completed':
      case 'cancelled':
        return theme.text.secondary;
      default:
        return theme.text.primary;
    }
  })();
  const strikethrough = todo.status === 'cancelled';

  return (
    <Box flexDirection="row" columnGap={1} aria-role={ariaRole}>
      <TodoStatusDisplay status={todo.status} isWorking={isWorking} />
      <Box flexShrink={1}>
        <Text color={textColor} wrap={wrap} strikethrough={strikethrough}>
          {todo.description}
        </Text>
      </Box>
    </Box>
  );
};

export const TodoTray: React.FC = () => {
  const uiState = useUIState();

  // UI state can be restored from an older persisted snapshot that predates
  // DSH todo projection. Treat a missing field as an empty tray while that
  // snapshot is being upgraded.
  const todos: TodoList | null = uiState.todos ?? null;
  const isWorking = uiState.streamingState === StreamingState.Responding;

  const inProgress: Todo | null = useMemo(() => {
    if (todos === null) {
      return null;
    }
    return todos.todos.find((todo) => todo.status === 'in_progress') || null;
  }, [todos]);

  const hasActiveTodos = useMemo(() => {
    if (!todos || !todos.todos) return false;
    return todos.todos.some(
      (todo) => todo.status === 'pending' || todo.status === 'in_progress',
    );
  }, [todos]);

  if (
    todos === null ||
    !todos.todos ||
    todos.todos.length === 0 ||
    (!uiState.showFullTodos && !hasActiveTodos)
  ) {
    return null;
  }

  return (
    <Box
      borderStyle="single"
      borderBottom={false}
      borderRight={false}
      borderLeft={false}
      borderColor={theme.border.default}
      paddingLeft={1}
      paddingRight={1}
    >
      {uiState.showFullTodos ? (
        <Box flexDirection="column" rowGap={1}>
          <TodoTitleDisplay todos={todos} isWorking={isWorking} />
          <TodoListDisplay todos={todos} isWorking={isWorking} />
        </Box>
      ) : (
        <Box flexDirection="row" columnGap={1} height={1}>
          <Box flexShrink={1} flexGrow={0}>
            <TodoTitleDisplay todos={todos} isWorking={isWorking} compact />
          </Box>
          {inProgress && (
            <Box flexShrink={1} flexGrow={1}>
              <TodoItemDisplay
                todo={inProgress}
                wrap="truncate"
                isWorking={isWorking}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

interface TodoListDisplayProps {
  todos: TodoList;
  isWorking: boolean;
}

const TodoListDisplay: React.FC<TodoListDisplayProps> = ({ todos, isWorking }) => (
  <Box flexDirection="column" aria-role="list">
    {todos.todos.map((todo: Todo, index: number) => (
      <TodoItemDisplay
        todo={todo}
        key={index}
        role="listitem"
        isWorking={isWorking}
      />
    ))}
  </Box>
);
