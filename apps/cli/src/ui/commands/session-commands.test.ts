/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { SessionManagementRuntime } from '../session-management-runtime.js';
import { SessionDialog } from '../components/dialogs/session-dialog.js';
import { newCommand, resumeCommand, sessionsCommand } from './session-commands.js';

function runtime(overrides: { conversation?: boolean; busy?: boolean } = {}): SessionManagementRuntime {
  return {
    getSnapshot: () => ({ currentSessionId: 'dsh-console-current' }),
    subscribe: () => () => {},
    listSessions: vi.fn(async () => []),
    resolveSessionTitles: vi.fn(async () => []),
    createNew: vi.fn(async () => {}),
    resumeLatest: vi.fn(async () => {}),
    resumeSession: vi.fn(async () => {}),
    hasConversation: vi.fn(() => overrides.conversation ?? true),
    isBusy: vi.fn(() => overrides.busy ?? false),
  };
}

describe('Session commands', () => {
  it('confirms before replacing a populated transcript with /new', async () => {
    const sessionManagement = runtime();
    const context = createMockCommandContext({
      invocation: { raw: '/new' },
      services: { sessionManagement },
    });
    await expect(newCommand.action?.(context, '')).resolves.toMatchObject({
      type: 'confirm_action',
      originalInvocation: { raw: '/new' },
    });
    expect(sessionManagement.createNew).not.toHaveBeenCalled();
  });

  it('does not create another empty Session', async () => {
    const sessionManagement = runtime({ conversation: false });
    const context = createMockCommandContext({ services: { sessionManagement } });
    const result = await newCommand.action?.(context, '');
    expect(result && 'content' in result ? result.content : '').toContain('already empty');
    expect(sessionManagement.createNew).not.toHaveBeenCalled();
  });

  it('opens the shared Session dialog for /sessions and bare /resume', async () => {
    const sessionManagement = runtime();
    const context = createMockCommandContext({ services: { sessionManagement } });
    for (const command of [sessionsCommand, resumeCommand]) {
      const result = await command.action?.(context, '');
      expect(result).toMatchObject({ type: 'custom_dialog' });
      expect(result && 'component' in result ? result.component.type : undefined).toBe(SessionDialog);
    }
  });

  it('directly resumes a full id after confirmation', async () => {
    const sessionManagement = runtime();
    const context = createMockCommandContext({
      overwriteConfirmed: true,
      invocation: { raw: '/resume dsh-console-history' },
      services: { sessionManagement },
    });
    const result = await resumeCommand.action?.(context, 'dsh-console-history');
    expect(sessionManagement.resumeSession).toHaveBeenCalledWith('dsh-console-history');
    expect(result).toBeUndefined();
  });

  it('treats the current Session as a no-op', async () => {
    const sessionManagement = runtime();
    const context = createMockCommandContext({ services: { sessionManagement } });
    const result = await resumeCommand.action?.(context, 'dsh-console-current');
    expect(result && 'content' in result ? result.content : '').toContain('already active');
    expect(sessionManagement.resumeSession).not.toHaveBeenCalled();
  });
});
