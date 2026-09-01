/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { act } from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderSetupRuntime } from '../../provider-setup-runtime.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { ProviderSetupDialog } from './provider-setup-dialog.js';

vi.mock('../../hooks/input/use-keypress.js', () => ({
  useKeypress: vi.fn(),
}));

const mockedUseKeypress = vi.mocked(useKeypress);

beforeEach(() => {
  vi.clearAllMocks();
});

function latestKeypressHandler() {
  return mockedUseKeypress.mock.calls.at(-1)?.[0];
}

function runtime(
  configure: ProviderSetupRuntime['configure'] = vi.fn(async () => ({
    provider: 'deepseek-official',
    displayName: 'DeepSeek',
    status: 'configured' as const,
    credentialLabel: 'DEEPSEEK_API_KEY',
    writable: true,
  })),
): ProviderSetupRuntime {
  const current = {
    provider: 'deepseek-official',
    displayName: 'DeepSeek',
    status: 'missing' as const,
    credentialLabel: 'DEEPSEEK_API_KEY',
    writable: true,
  };
  return {
    getSnapshot: () => ({ current }),
    subscribe: () => () => {},
    listProviders: vi.fn(async () => [current]),
    describeProvider: vi.fn(async () => current),
    configure,
  };
}

describe('ProviderSetupDialog', () => {
  it('masks typed and pasted credential content', async () => {
    const setup = runtime();
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <ProviderSetupDialog
          runtime={setup}
          provider="deepseek-official"
          reason="first-run"
          onCancel={vi.fn()}
          onConfigured={vi.fn()}
        />,
      );
      await Promise.resolve();
    });
    const handler = latestKeypressHandler();
    expect(handler).toBeDefined();

    await act(async () => {
      handler?.({
        name: 'paste',
        sequence: 'provider-secret-value',
        insertable: true,
        shift: false,
        alt: false,
        ctrl: false,
        cmd: false,
      });
    });

    expect(view.lastFrame()).not.toContain('provider-secret-value');
    expect(view.lastFrame()).toContain('*********************');
    expect(view.lastFrame()).toContain(
      'Enter your DeepSeek API key to continue.',
    );
    expect(view.lastFrame()).toContain('Enter Save and continue');
    expect(view.lastFrame()).toContain('Esc Cancel');
    expect(view.lastFrame()).not.toContain('skip');
  });

  it('aborts an in-flight save when cancelled', async () => {
    let receivedSignal: AbortSignal | undefined;
    const configure = vi.fn(
      async (_provider: string, _value: string, signal?: AbortSignal) => {
        receivedSignal = signal;
        await new Promise(() => {});
        throw new Error('unreachable');
      },
    );
    const onCancel = vi.fn();
    await act(async () => {
      render(
        <ProviderSetupDialog
          runtime={runtime(configure)}
          provider="deepseek-official"
          onCancel={onCancel}
          onConfigured={vi.fn()}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      latestKeypressHandler()?.({
        name: '',
        sequence: 's',
        insertable: true,
        shift: false,
        alt: false,
        ctrl: false,
        cmd: false,
      });
    });
    await act(async () => {
      latestKeypressHandler()?.({
        name: 'return',
        sequence: '\r',
        insertable: false,
        shift: false,
        alt: false,
        ctrl: false,
        cmd: false,
      });
      await Promise.resolve();
    });
    await act(async () => {
      latestKeypressHandler()?.({
        name: 'escape',
        sequence: '\u001b',
        insertable: false,
        shift: false,
        alt: false,
        ctrl: false,
        cmd: false,
      });
    });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('supports deleting and clearing a mistyped credential', async () => {
    const onCancel = vi.fn();
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <ProviderSetupDialog
          runtime={runtime()}
          provider="deepseek-official"
          reason="first-run"
          onCancel={onCancel}
          onConfigured={vi.fn()}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      latestKeypressHandler()?.({
        name: 'paste',
        sequence: 'wrong-key',
        insertable: true,
        shift: false,
        alt: false,
        ctrl: false,
        cmd: false,
      });
    });
    await act(async () => {
      latestKeypressHandler()?.({
        name: 'h',
        sequence: '\b',
        insertable: false,
        shift: false,
        alt: false,
        ctrl: true,
        cmd: false,
      });
    });
    expect(view.lastFrame()).toContain('********');

    await act(async () => {
      latestKeypressHandler()?.({
        name: 'c',
        sequence: '\x03',
        insertable: false,
        shift: false,
        alt: false,
        ctrl: true,
        cmd: false,
      });
    });
    expect(view.lastFrame()).toContain('Paste your DeepSeek API key');
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      latestKeypressHandler()?.({
        name: 'c',
        sequence: '\x03',
        insertable: false,
        shift: false,
        alt: false,
        ctrl: true,
        cmd: false,
      });
    });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
