/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@deepseek-ai/cordis';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import type { LlmConfigurableProvider } from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-settings';
import type {
  ProviderSetupRuntime,
  ProviderSetupSnapshot,
  ProviderSetupView,
} from '../ui/provider-setup-runtime.js';

const DEEPSEEK_SETTINGS_NAMESPACE = 'llm-deepseek';
const DEFAULT_DEEPSEEK_CREDENTIAL = 'DEEPSEEK_API_KEY';

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

function valueAtPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export class DshProviderSetupRuntime implements ProviderSetupRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: ProviderSetupSnapshot;

  private constructor(
    private readonly credentials: Context['credentials'],
    private readonly settings: Context['settings'],
    private readonly llm: Context['llm'],
    private readonly currentProvider: () => string,
    current: ProviderSetupView,
  ) {
    this.snapshot = { current };
  }

  static async create(
    credentials: Context['credentials'],
    settings: Context['settings'],
    llm: Context['llm'],
    currentProvider: () => string,
  ): Promise<DshProviderSetupRuntime> {
    const provider = currentProvider();
    const runtime = new DshProviderSetupRuntime(
      credentials,
      settings,
      llm,
      currentProvider,
      {
        provider,
        displayName: provider,
        status: 'unsupported',
        writable: false,
      },
    );
    await runtime.refreshCurrent();
    return runtime;
  }

  getSnapshot = (): ProviderSetupSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async listProviders(
    signal?: AbortSignal,
  ): Promise<readonly ProviderSetupView[]> {
    throwIfAborted(signal);
    return Promise.all(
      this.llm.listConfigurableProviders().map(async (entry) => {
        try {
          return await this.describeProvider(entry.provider, signal);
        } catch (error) {
          if (signal?.aborted) throw error;
          return {
            provider: entry.provider,
            displayName: entry.displayName,
            status: 'error' as const,
            writable: false,
            message:
              error instanceof Error
                ? error.message
                : 'Provider configuration could not be inspected.',
          };
        }
      }),
    );
  }

  async describeProvider(
    provider: string,
    signal?: AbortSignal,
  ): Promise<ProviderSetupView> {
    throwIfAborted(signal);
    const entry = this.llm
      .listConfigurableProviders()
      .find((candidate) => candidate.provider === provider);
    if (!entry) {
      return {
        provider,
        displayName: provider,
        status: 'unsupported',
        writable: false,
        message: 'This provider does not expose DSH-managed setup.',
      };
    }
    const credentialName = this.credentialName(entry);
    if (!credentialName) {
      return {
        provider,
        displayName: entry.displayName,
        status: 'unsupported',
        writable: false,
        message:
          'This provider uses a setup flow that is not available in DSH Console yet.',
      };
    }
    const info = await this.credentials.describe(credentialRef(credentialName));
    throwIfAborted(signal);
    return {
      provider,
      displayName: entry.displayName,
      status: info.configured ? 'configured' : 'missing',
      credentialLabel: credentialName,
      ...(info.source === undefined ? {} : { source: info.source }),
      writable: info.writable,
    };
  }

  async configure(
    provider: string,
    value: string,
    signal?: AbortSignal,
  ): Promise<ProviderSetupView> {
    const normalized = value.trim();
    if (normalized.length === 0) throw new Error('API key cannot be empty.');
    if (normalized.length > 16_384) throw new Error('API key is too long.');
    throwIfAborted(signal);
    const before = await this.describeProvider(provider, signal);
    if (!before.credentialLabel || before.status === 'unsupported') {
      throw new Error(
        before.message ?? 'This provider cannot be configured here.',
      );
    }
    if (!before.writable) {
      throw new Error(
        `${before.credentialLabel} is supplied by a read-only source and cannot be changed here.`,
      );
    }
    try {
      await this.credentials.set(
        credentialRef(before.credentialLabel),
        normalized,
      );
    } catch {
      throw new Error(
        `Unable to save ${before.credentialLabel} through the DSH credentials service.`,
      );
    }
    const configured = await this.describeProvider(provider);
    if (provider === this.currentProvider()) this.publish(configured);
    throwIfAborted(signal);
    return configured;
  }

  async refreshCurrent(signal?: AbortSignal): Promise<void> {
    const provider = this.currentProvider();
    try {
      this.publish(await this.describeProvider(provider, signal));
    } catch (error) {
      if (signal?.aborted) throw error;
      this.publish({
        provider,
        displayName: provider,
        status: 'error',
        writable: false,
        message:
          error instanceof Error
            ? error.message
            : 'Provider configuration failed.',
      });
    }
  }

  private credentialName(
    entry: LlmConfigurableProvider,
  ): string | undefined {
    if (String(entry.settingsNs) !== DEEPSEEK_SETTINGS_NAMESPACE) {
      return undefined;
    }
    const descriptor = this.settings
      .describe({ redactSecrets: true })
      .find(
        (candidate) => String(candidate.ns) === String(entry.settingsNs),
      );
    const profile = valueAtPath(descriptor?.value, entry.settingsPath);
    if (typeof profile === 'object' && profile !== null) {
      const configured = (profile as Record<string, unknown>)['apiKeyEnv'];
      if (typeof configured === 'string' && configured.length > 0) {
        return configured;
      }
    }
    return DEFAULT_DEEPSEEK_CREDENTIAL;
  }

  private publish(current: ProviderSetupView): void {
    this.snapshot = { current };
    for (const listener of this.listeners) listener();
  }
}
