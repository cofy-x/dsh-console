/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ToolParameterView {
  name: string;
  type: string;
  description?: string;
  required: boolean;
}

export interface ToolCatalogItemView {
  name: string;
  description: string;
  parameters: readonly ToolParameterView[];
}

export interface ToolCatalogSnapshot {
  tools: readonly ToolCatalogItemView[];
}

/** Read-only catalog of the tools visible to the current DSH Agent. */
export interface ToolCatalogRuntime {
  /** Returns the same snapshot object until the catalog actually changes. */
  getSnapshot(): ToolCatalogSnapshot;
  subscribe(listener: () => void): () => void;
}
