/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProviderSetupStatus =
  | 'configured'
  | 'missing'
  | 'unsupported'
  | 'error';

export interface ProviderSetupView {
  provider: string;
  displayName: string;
  status: ProviderSetupStatus;
  credentialLabel?: string;
  source?: string;
  writable: boolean;
  message?: string;
}

export interface ProviderSetupSnapshot {
  current: ProviderSetupView;
}

export interface ProviderSetupRuntime {
  getSnapshot(): ProviderSetupSnapshot;
  subscribe(listener: () => void): () => void;
  listProviders(signal?: AbortSignal): Promise<readonly ProviderSetupView[]>;
  describeProvider(
    provider: string,
    signal?: AbortSignal,
  ): Promise<ProviderSetupView>;
  configure(
    provider: string,
    value: string,
    signal?: AbortSignal,
  ): Promise<ProviderSetupView>;
}
