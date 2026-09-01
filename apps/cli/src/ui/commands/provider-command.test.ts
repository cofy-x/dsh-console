/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { ProviderSetupRuntime } from '../provider-setup-runtime.js';
import { ProviderDialog } from '../components/dialogs/provider-dialog.js';
import { providerCommand } from './provider-command.js';

function runtime(): ProviderSetupRuntime {
  const current = {
    provider: 'deepseek-official',
    displayName: 'DeepSeek',
    status: 'configured' as const,
    credentialLabel: 'DEEPSEEK_API_KEY',
    source: 'file',
    writable: true,
  };
  return {
    getSnapshot: () => ({ current }),
    subscribe: () => () => {},
    listProviders: vi.fn(async () => [current]),
    describeProvider: vi.fn(async () => current),
    configure: vi.fn(async () => current),
  };
}

describe('/provider', () => {
  it('opens the interactive provider dialog', async () => {
    const providerSetup = runtime();
    const context = createMockCommandContext({ services: { providerSetup } });
    const result = await providerCommand.action?.(context, 'DeepSeek');

    expect(result).toMatchObject({ type: 'custom_dialog' });
    if (!result || !('component' in result)) throw new Error('Dialog expected');
    expect(result.component).toMatchObject({
      type: ProviderDialog,
      props: {
        runtime: providerSetup,
        initialProvider: 'DeepSeek',
      },
    });
  });

  it('rejects extra arguments', async () => {
    const context = createMockCommandContext({
      services: { providerSetup: runtime() },
    });
    const result = await providerCommand.action?.(context, 'deepseek extra');
    expect(result).toMatchObject({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /provider [provider]',
    });
  });

  it('completes canonical provider identifiers', async () => {
    const context = createMockCommandContext({
      services: { providerSetup: runtime() },
    });
    await expect(
      providerCommand.completion?.(context, 'deep'),
    ).resolves.toEqual(['deepseek-official']);
  });
});
