/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { act, StrictMode } from 'react';
import { renderWithProviders } from '../../../test-utils/render.js';
import type {
  AgentActivityRuntime,
  AgentActivitySnapshot,
} from '../../agent-activity-runtime.js';
import type { SessionExplorerRuntime } from '../../session-explorer-runtime.js';
import type { SessionManagementRuntime } from '../../session-management-runtime.js';
import { JobsDialog } from './jobs-dialog.js';
import { GoalDialog } from './goal-dialog.js';
import { SessionExplorerDialog } from './session-explorer-dialog.js';
import { plainPanelLine, plainPanelText } from './activity-dialog-shared.js';

function activity(snapshot: AgentActivitySnapshot): AgentActivityRuntime {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    stopJob: vi.fn(),
    changeGoal: vi.fn(async () => {}),
  };
}
describe('Activity dialogs', () => {
  it('renders the empty Jobs state and supports Escape', async () => {
    const onClose = vi.fn();
    const { lastFrame, stdin } = renderWithProviders(
      <JobsDialog
        runtime={activity({ jobs: [], busy: false })}
        onClose={onClose}
      />,
    );
    expect(lastFrame()).toContain('No jobs');
    stdin.write('\u001b');
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it('opens directly into Goal creation and changes state only after confirmation', async () => {
    const runtime = activity({
      sessionId: 'dsh-console-current',
      jobs: [],
      busy: false,
    });
    const { lastFrame, stdin } = renderWithProviders(
      <StrictMode>
        <GoalDialog runtime={runtime} onClose={() => {}} />
      </StrictMode>,
    );
    const key = async (value: string) => {
      await act(async () => {
        stdin.write(value);
        await Promise.resolve();
      });
    };
    await vi.waitFor(() => expect(lastFrame()).toContain('Goal objective'));
    expect(lastFrame()).not.toContain('Session:');
    expect(lastFrame()).not.toContain('DSH owns');
    await key('Ship safe goals');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Ship safe goals');
    });
    await key('\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Start goal?'));
    expect(lastFrame()).not.toContain('No active goal');
    expect(lastFrame()).toContain('Objective');
    expect(runtime.changeGoal).not.toHaveBeenCalled();
    await key('\u001b[B');
    await key('\r');
    await vi.waitFor(() =>
      expect(runtime.changeGoal).toHaveBeenCalledWith(
        { sessionId: 'dsh-console-current', goal: undefined },
        { kind: 'create', objective: 'Ship safe goals' },
        expect.any(AbortSignal),
      ),
    );
    await vi.waitFor(() => expect(lastFrame()).not.toContain('Start goal'));
  });

  it('requires a separate confirmation before stopping a selected job', async () => {
    const runtime = activity({
      sessionId: 'dsh-console-current',
      busy: false,
      jobs: [
        {
          id: 'bash-1',
          kind: 'bash',
          label: 'Build project',
          sessionId: 'dsh-console-current',
          status: 'running',
          startedAt: Date.now(),
        },
      ],
    });
    const { lastFrame, stdin } = renderWithProviders(
      <JobsDialog runtime={runtime} onClose={() => {}} />,
    );
    const key = async (value: string) => {
      await act(async () => {
        stdin.write(value);
        await Promise.resolve();
      });
    };
    await key('\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Stop job...'));
    await key('\u001b[B');
    await key('\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Keep running'));
    expect(runtime.stopJob).not.toHaveBeenCalled();
    await key('\u001b[B');
    await key('\r');
    expect(runtime.stopJob).toHaveBeenCalledWith(
      'dsh-console-current',
      'bash-1',
    );
  });

  it('makes restored goal activation explicit without automatically resuming', () => {
    const runtime = activity({
      sessionId: 'dsh-console-current',
      jobs: [],
      busy: false,
      goal: {
        id: 'goal-1',
        revision: 2,
        objective: 'Finish migration',
        phase: 'active',
        activation: 'disarmed',
        roundsStarted: 2,
        maxGoalRounds: 5,
      },
    });
    const { lastFrame } = renderWithProviders(
      <GoalDialog runtime={runtime} onClose={() => {}} />,
    );
    expect(lastFrame()).toContain('Ready to resume · Round 2');
    expect(lastFrame()).not.toContain('disarmed');
    expect(lastFrame()).not.toContain('2/5');
    expect(runtime.changeGoal).not.toHaveBeenCalled();
  });
  it('loads searchable history and surfaces loading errors', async () => {
    const explorer = {
      search: vi.fn(async () => {
        throw new Error('history unavailable');
      }),
    } as unknown as SessionExplorerRuntime;
    const { lastFrame } = renderWithProviders(
      <SessionExplorerDialog
        runtime={{} as SessionManagementRuntime}
        explorer={explorer}
        onClose={() => {}}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(lastFrame()).toContain('history unavailable'),
    );
  });
  it('keeps search visible and filters as the user types', async () => {
    const explorer = {
      search: vi.fn(async () => ({ items: [] })),
    } as unknown as SessionExplorerRuntime;
    const { lastFrame, stdin } = renderWithProviders(
      <SessionExplorerDialog
        runtime={{} as SessionManagementRuntime}
        explorer={explorer}
        onClose={() => {}}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(lastFrame()).toContain('Search titles'));
    await act(async () => {
      stdin.write('hello');
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    await vi.waitFor(() =>
      expect(explorer.search).toHaveBeenCalledWith(
        'hello',
        expect.any(AbortSignal),
      ),
    );
  });
  it('shows one loading state until the first Session page is ready', async () => {
    let publish: (() => void) | undefined;
    let calls = 0;
    const first = {
      id: 'dsh-console-first',
      title: 'First Session',
      createdAt: 1,
      current: false,
      persisted: true,
      resumable: true,
    };
    const newer = {
      ...first,
      id: 'dsh-console-newer',
      title: 'Newer Session',
      createdAt: 2,
    };
    const explorer = {
      subscribe: vi.fn((listener: () => void) => {
        publish = listener;
        return () => {};
      }),
      search: vi.fn(async () =>
        calls++ === 0
          ? { items: [first], loading: true }
          : { items: [newer, first], loading: false },
      ),
    } as unknown as SessionExplorerRuntime;
    const { lastFrame } = renderWithProviders(
      <SessionExplorerDialog
        runtime={{} as SessionManagementRuntime}
        explorer={explorer}
        onClose={() => {}}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Loading Sessions');
      expect(lastFrame()).not.toContain('First Session');
    });
    await act(async () => {
      publish?.();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(lastFrame()).toContain('Newer Session'));
    const frame = lastFrame() ?? '';
    expect(frame.indexOf('Newer Session')).toBeLessThan(
      frame.indexOf('First Session'),
    );
    expect(frame).not.toContain('Loading Sessions');
    expect(frame).not.toContain('Loading more Sessions');
  });
  it('finishes opening an empty Session while the catalog publishes', async () => {
    let publish: (() => void) | undefined;
    let finishPreview:
      | ((value: { id: string; messages: []; turns: [] }) => void)
      | undefined;
    const item = {
      id: 'dsh-console-empty',
      createdAt: 1,
      current: false,
      persisted: true,
      resumable: false,
    };
    const explorer = {
      subscribe: vi.fn((listener: () => void) => {
        publish = listener;
        return () => {};
      }),
      search: vi.fn(async () => ({ items: [item] })),
      preview: vi.fn(
        () =>
          new Promise<{
            id: string;
            messages: [];
            turns: [];
          }>((resolve) => {
            finishPreview = resolve;
          }),
      ),
    } as unknown as SessionExplorerRuntime;
    const { lastFrame, stdin } = renderWithProviders(
      <SessionExplorerDialog
        runtime={{} as SessionManagementRuntime}
        explorer={explorer}
        onClose={() => {}}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(lastFrame()).toContain('Session empty'));
    await act(async () => {
      stdin.write('\r');
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(lastFrame()).toContain('Loading Session...'));
    expect(lastFrame()).not.toContain('Working...');
    await act(async () => {
      publish?.();
      finishPreview?.({ id: item.id, messages: [], turns: [] });
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(lastFrame()).toContain(
        'This Session has no conversation messages.',
      ),
    );
    expect(lastFrame()).not.toContain('Loading Session...');
    expect(explorer.search).toHaveBeenCalledOnce();
  });
  it('cancels the history observer when the dialog unmounts', async () => {
    let observed: AbortSignal | undefined;
    const explorer = {
      search: vi.fn((_query, signal) => {
        observed = signal;
        return new Promise(() => {});
      }),
    } as unknown as SessionExplorerRuntime;
    const { unmount } = renderWithProviders(
      <SessionExplorerDialog
        runtime={{} as SessionManagementRuntime}
        explorer={explorer}
        onClose={() => {}}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(observed).toBeDefined();
    act(() => unmount());
    expect(observed?.aborted).toBe(true);
  });
  it('lets Escape cancel a history load without waiting for the query', async () => {
    const onClose = vi.fn();
    const explorer = {
      search: vi.fn(() => new Promise(() => {})),
    } as unknown as SessionExplorerRuntime;
    const { stdin } = renderWithProviders(
      <SessionExplorerDialog
        runtime={{} as SessionManagementRuntime}
        explorer={explorer}
        onClose={onClose}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(explorer.search).toHaveBeenCalled();
    await act(async () => {
      stdin.write('\u001b');
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('removes terminal control sequences from untrusted previews', () => {
    expect(plainPanelText('\u001b[31mred\u001b[0m\u0007\u202enext\nline')).toBe(
      'rednext\nline',
    );
    expect(plainPanelLine(' title\n\twith   layout ')).toBe(
      'title with layout',
    );
  });
});
