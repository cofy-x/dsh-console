/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@deepseek-ai/cordis';
import { describe, expect, it, vi } from 'vitest';
import { DshProviderSetupRuntime } from './provider-setup-runtime.js';

describe('DshProviderSetupRuntime', () => {
  it('uses the settings-derived DeepSeek credential reference', async () => {
    const describeCredential = vi
      .fn()
      .mockResolvedValueOnce({ configured: false, writable: true })
      .mockResolvedValue({
        configured: true,
        writable: true,
        source: 'file',
      });
    const set = vi.fn().mockResolvedValue(undefined);
    const credentials = {
      describe: describeCredential,
      set,
    } as unknown as Context['credentials'];
    const settings = {
      describe: () => [
        {
          ns: 'llm-deepseek',
          value: { apiKeyEnv: 'CUSTOM_DEEPSEEK_KEY' },
        },
      ],
    } as unknown as Context['settings'];
    const llm = {
      listConfigurableProviders: () => [
        {
          provider: 'deepseek-official',
          displayName: 'DeepSeek',
          settingsNs: 'llm-deepseek',
          settingsPath: [],
        },
      ],
    } as unknown as Context['llm'];
    const runtime = await DshProviderSetupRuntime.create(
      credentials,
      settings,
      llm,
      () => 'deepseek-official',
    );

    expect(runtime.getSnapshot().current).toMatchObject({
      status: 'missing',
      credentialLabel: 'CUSTOM_DEEPSEEK_KEY',
    });
    await runtime.configure('deepseek-official', 'secret');
    expect(set).toHaveBeenCalledWith('CUSTOM_DEEPSEEK_KEY', 'secret');
    expect(runtime.getSnapshot().current).toMatchObject({
      status: 'configured',
      source: 'file',
    });
  });

  it('does not claim unsupported provider setup', async () => {
    const runtime = await DshProviderSetupRuntime.create(
      {} as Context['credentials'],
      {} as Context['settings'],
      {
        listConfigurableProviders: () => [],
      } as unknown as Context['llm'],
      () => 'custom',
    );

    expect(runtime.getSnapshot().current.status).toBe('unsupported');
  });

  it('lists DSH configurable providers with isolated inspection errors', async () => {
    const runtime = await DshProviderSetupRuntime.create(
      {
        describe: vi
          .fn()
          .mockResolvedValueOnce({ configured: true, writable: true })
          .mockRejectedValueOnce(new Error('credential source unavailable'))
          .mockResolvedValueOnce({ configured: true, writable: true }),
      } as unknown as Context['credentials'],
      {
        describe: () => [{ ns: 'llm-deepseek', value: {} }],
      } as unknown as Context['settings'],
      {
        listConfigurableProviders: () => [
          {
            provider: 'deepseek-official',
            displayName: 'DeepSeek',
            settingsNs: 'llm-deepseek',
            settingsPath: [],
          },
          {
            provider: 'deepseek-secondary',
            displayName: 'DeepSeek Secondary',
            settingsNs: 'llm-deepseek',
            settingsPath: [],
          },
        ],
      } as unknown as Context['llm'],
      () => 'deepseek-official',
    );

    await expect(runtime.listProviders()).resolves.toEqual([
      expect.objectContaining({
        provider: 'deepseek-official',
        status: 'error',
        message: 'credential source unavailable',
      }),
      expect.objectContaining({
        provider: 'deepseek-secondary',
        status: 'configured',
      }),
    ]);
  });

  it('rejects read-only credentials without attempting a write', async () => {
    const set = vi.fn();
    const runtime = await DshProviderSetupRuntime.create(
      {
        describe: vi.fn().mockResolvedValue({
          configured: false,
          writable: false,
          source: 'env',
        }),
        set,
      } as unknown as Context['credentials'],
      {
        describe: () => [{ ns: 'llm-deepseek', value: {} }],
      } as unknown as Context['settings'],
      {
        listConfigurableProviders: () => [
          {
            provider: 'deepseek-official',
            displayName: 'DeepSeek',
            settingsNs: 'llm-deepseek',
            settingsPath: [],
          },
        ],
      } as unknown as Context['llm'],
      () => 'deepseek-official',
    );

    await expect(
      runtime.configure('deepseek-official', 'secret'),
    ).rejects.toThrow(/read-only source/);
    expect(set).not.toHaveBeenCalled();
  });

  it('publishes a completed write before reporting a late cancellation', async () => {
    const controller = new AbortController();
    const describeCredential = vi
      .fn()
      .mockResolvedValueOnce({ configured: false, writable: true })
      .mockResolvedValueOnce({ configured: false, writable: true })
      .mockImplementationOnce(async () => {
        controller.abort();
        return { configured: true, writable: true, source: 'file' };
      });
    const runtime = await DshProviderSetupRuntime.create(
      {
        describe: describeCredential,
        set: vi.fn(),
      } as unknown as Context['credentials'],
      {
        describe: () => [{ ns: 'llm-deepseek', value: {} }],
      } as unknown as Context['settings'],
      {
        listConfigurableProviders: () => [
          {
            provider: 'deepseek-official',
            displayName: 'DeepSeek',
            settingsNs: 'llm-deepseek',
            settingsPath: [],
          },
        ],
      } as unknown as Context['llm'],
      () => 'deepseek-official',
    );

    await expect(
      runtime.configure('deepseek-official', 'secret', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(runtime.getSnapshot().current.status).toBe('configured');
  });
});
