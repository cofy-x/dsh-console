/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  ApprovalOutcome,
  ApprovalRequest,
} from '@deepseek-ai/dsh-user-approval';
import { CallId } from '@deepseek-ai/dsh-llm';
import { DshApprovalRuntime } from './approval-runtime.js';

type Listener = (
  request: ApprovalRequest,
  next: () => Promise<ApprovalOutcome>,
) => Promise<ApprovalOutcome>;

function setup() {
  const owned = {} as Agent;
  let listener: Listener | undefined;
  const off = vi.fn();
  const runtime = new DshApprovalRuntime(
    (registered) => {
      listener = registered;
      return off;
    },
    (agent) => agent === owned,
  );
  return {
    owned,
    runtime,
    off,
    ask: (request: Omit<ApprovalRequest, 'agent'>, next = vi.fn()) => {
      if (listener === undefined) throw new Error('listener not registered');
      return listener({ ...request, agent: owned }, next);
    },
    dispatch: (
      request: ApprovalRequest,
      next: () => Promise<ApprovalOutcome>,
    ) => {
      if (listener === undefined) throw new Error('listener not registered');
      return listener(request, next);
    },
  };
}

describe('DshApprovalRuntime', () => {
  it('queues an owned request and returns the selected one-shot outcome', async () => {
    const { ask, runtime } = setup();
    const outcome = ask({
      toolName: 'bash',
      reason: 'write outside workspace',
    });
    const request = runtime.getSnapshot().pending[0];

    expect(request).toMatchObject({
      toolName: 'bash',
      reason: 'write outside workspace',
    });
    runtime.respond(request.id, 'allowed-once');

    await expect(outcome).resolves.toBe('allowed-once');
    expect(runtime.getSnapshot().pending).toHaveLength(0);
  });

  it('delegates requests for Agents it does not own', async () => {
    const { dispatch, runtime } = setup();
    const next = vi.fn().mockResolvedValue('rejected' as const);

    await expect(
      dispatch({ agent: {} as Agent, toolName: 'bash' }, next),
    ).resolves.toBe('rejected');
    expect(next).toHaveBeenCalledOnce();
    expect(runtime.getSnapshot().pending).toHaveLength(0);
  });

  it('sanitizes untrusted request labels before publishing the View Model', async () => {
    const { ask, runtime } = setup();
    const outcome = ask({
      toolName: 'bash\u001b[31m',
      callId: CallId('call\n1'),
      reason: 'write\n\u001b[2Joutside',
    });

    expect(runtime.getSnapshot().pending[0]).toMatchObject({
      toolName: 'bash',
      callId: 'call 1',
      reason: 'write outside',
    });
    runtime.respond(runtime.getSnapshot().pending[0].id, 'rejected');
    await expect(outcome).resolves.toBe('rejected');
  });

  it('cancels a pending request when its signal aborts', async () => {
    const { ask, runtime } = setup();
    const controller = new AbortController();
    const outcome = ask({ toolName: 'bash', signal: controller.signal });

    controller.abort();

    await expect(outcome).resolves.toBe('cancelled');
    expect(runtime.getSnapshot().pending).toHaveLength(0);
  });

  it('fails pending requests closed when disposed', async () => {
    const { ask, runtime, off } = setup();
    const outcome = ask({ toolName: 'bash' });

    runtime.dispose();

    await expect(outcome).resolves.toBe('unavailable');
    expect(off).toHaveBeenCalledOnce();
  });
});
