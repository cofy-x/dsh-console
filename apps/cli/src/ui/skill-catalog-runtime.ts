/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SkillCatalogItemView {
  name: string;
  description: string;
  whenToUse?: string;
  modelInvocable: boolean;
}

export interface SkillCatalogSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error';
  skills: readonly SkillCatalogItemView[];
  error?: string;
}

export interface SkillCatalogRuntime {
  getSnapshot(): SkillCatalogSnapshot;
  subscribe(listener: () => void): () => void;
  prepare(signal?: AbortSignal): Promise<void>;
}
