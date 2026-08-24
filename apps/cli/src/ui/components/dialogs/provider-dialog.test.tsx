/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { act } from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import type {
  ProviderSetupRuntime,
  ProviderSetupView,
} from '../../provider-setup-runtime.js';
import { ProviderDialog } from './provider-dialog.js';

vi.mock('../../hooks/input/use-keypress.js', () => ({
  useKeypress: vi.fn(),
}));

function runtime(
  provider: ProviderSetupView,
  available: readonly ProviderSetupView[] = [provider],
): ProviderSetupRuntime {
  return {
    getSnapshot: () => ({ current: provider }),
    subscribe: () => () => {},
    listProviders: vi.fn(async () => available),
    describeProvider: vi.fn(async () => provider),
    configure: vi.fn(async () => provider),
  };
}

describe('ProviderDialog', () => {
  it('shows the active provider and its writable credential source', async () => {
    const provider = {
      provider: 'deepseek-official',
      displayName: 'DeepSeek',
      status: 'configured' as const,
      credentialLabel: 'DEEPSEEK_API_KEY',
      source: 'file',
      writable: true,
    };
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <ProviderDialog
          runtime={runtime(provider)}
          onClose={vi.fn()}
        />,
      );
      await Promise.resolve();
    });

    const frame = view.lastFrame();
    expect(frame).toContain('DeepSeek Configured Current');
    expect(frame).toContain('DEEPSEEK_API_KEY');
    expect(frame).toContain('file');
    expect(frame).toContain('Enter Replace credential');
  });

  it('does not describe an inspection error as a read-only source', async () => {
    const provider = {
      provider: 'deepseek-official',
      displayName: 'DeepSeek',
      status: 'error' as const,
      writable: false,
      message: 'Credential source unavailable.',
    };
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(
        <ProviderDialog
          runtime={runtime(provider)}
          onClose={vi.fn()}
        />,
      );
      await Promise.resolve();
    });

    const frame = view.lastFrame();
    expect(frame).toContain('Credential source unavailable.');
    expect(frame).not.toContain('read-only source');
  });
});
