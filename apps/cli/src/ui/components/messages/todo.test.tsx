/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect } from 'vitest';
import { Box } from 'ink';
import { TodoTray } from './todo.js';
import type { Todo } from '../../tool-result.js';
import type { UIState } from '../../contexts/ui-state-context.js';
import { UIStateContext } from '../../contexts/ui-state-context.js';
const todoList = (todos: Todo[]) => ({ todos });

describe.each([true, false])(
  '<TodoTray /> (showFullTodos: %s)',
  (showFullTodos: boolean) => {
    const renderWithUiState = (uiState: Partial<UIState>) =>
      render(
        <UIStateContext.Provider value={uiState as UIState}>
          <TodoTray />
        </UIStateContext.Provider>,
      );

    it('renders null when no todos exist', () => {
      const { lastFrame } = renderWithUiState({ todos: null, showFullTodos });
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders null when todo list is empty', () => {
      const { lastFrame } = renderWithUiState({
        todos: todoList([]),
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders when todos exist but none are in progress', () => {
      const { lastFrame } = renderWithUiState({
        todos: todoList([
            { description: 'Pending Task', status: 'pending' },
            { description: 'In Progress Task', status: 'cancelled' },
            { description: 'Completed Task', status: 'completed' },
          ]),
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders when todos exist and one is in progress', () => {
      const { lastFrame } = renderWithUiState({
        todos: todoList([
            { description: 'Pending Task', status: 'pending' },
            { description: 'Task 2', status: 'in_progress' },
            { description: 'In Progress Task', status: 'cancelled' },
            { description: 'Completed Task', status: 'completed' },
          ]),
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders a todo list with long descriptions that wrap when full view is on', () => {
      const { lastFrame } = render(
        <Box width="50">
          <UIStateContext.Provider
            value={
              {
                todos: todoList([
                    {
                      description:
                        'This is a very long description for a pending task that should wrap around multiple lines when the terminal width is constrained.',
                      status: 'in_progress',
                    },
                    {
                      description:
                        'Another completed task with an equally verbose description to test wrapping behavior.',
                      status: 'completed',
                    },
                  ]),
                showFullTodos,
              } as UIState
            }
          >
            <TodoTray />
          </UIStateContext.Provider>
        </Box>,
      );
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders the current DSH todo snapshot', () => {
      const { lastFrame } = renderWithUiState({
        todos: todoList([
            { description: 'Newer Task 1', status: 'pending' },
            { description: 'Newer Task 2', status: 'in_progress' },
          ]),
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders full list when all todos are inactive', () => {
      const { lastFrame } = renderWithUiState({
        todos: todoList([
            { description: 'Task 1', status: 'completed' },
            { description: 'Task 2', status: 'cancelled' },
          ]),
        showFullTodos,
      });
      expect(lastFrame()).toMatchSnapshot();
    });
  },
);
