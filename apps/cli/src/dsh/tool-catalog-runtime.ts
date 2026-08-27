/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolSchema } from '@deepseek-ai/dsh-llm';
import type { ToolRuntime } from '@deepseek-ai/dsh-tools';
import type {
  ToolCatalogItemView,
  ToolCatalogRuntime,
  ToolCatalogSnapshot,
  ToolParameterView,
} from '../ui/tool-catalog-runtime.js';

interface ParameterNode {
  type?: unknown;
  description?: unknown;
  enum?: unknown;
  oneOf?: unknown;
}

interface ParameterRoot {
  properties?: unknown;
  required?: unknown;
}

function parameterType(node: ParameterNode): string {
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    return node.enum.map((value) => String(value)).join(' | ');
  }
  if (Array.isArray(node.oneOf) && node.oneOf.length > 0) return 'one of';
  return typeof node.type === 'string' ? node.type : 'value';
}

function projectParameters(parameters: Record<string, unknown>): ToolParameterView[] {
  const root = parameters as ParameterRoot;
  if (
    typeof root.properties !== 'object' ||
    root.properties === null ||
    Array.isArray(root.properties)
  ) {
    return [];
  }
  const required = new Set(
    Array.isArray(root.required)
      ? root.required.filter((name): name is string => typeof name === 'string')
      : [],
  );
  return Object.entries(root.properties)
    .map(([name, value]): ToolParameterView => {
      const node =
        typeof value === 'object' && value !== null && !Array.isArray(value)
          ? (value as ParameterNode)
          : {};
      return Object.freeze({
        name,
        type: parameterType(node),
        ...(typeof node.description === 'string'
          ? { description: node.description }
          : {}),
        required: required.has(name),
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function projectTool(schema: ToolSchema): ToolCatalogItemView {
  return Object.freeze({
    name: schema.name,
    description: schema.description,
    parameters: Object.freeze(projectParameters(schema.parameters)),
  });
}

export class DshToolCatalogRuntime implements ToolCatalogRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: ToolCatalogSnapshot;
  private readonly off: () => void;

  constructor(
    private readonly tools: Pick<ToolRuntime, 'schemas'>,
    private readonly activeAgent: () => Agent | undefined,
    subscribe: (listener: () => void) => () => void,
  ) {
    this.snapshot = this.readSnapshot();
    this.off = subscribe(() => this.refresh());
  }

  getSnapshot = (): ToolCatalogSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  activeAgentChanged(): void {
    this.refresh();
  }

  dispose(): void {
    this.off();
    this.listeners.clear();
  }

  private readSnapshot(): ToolCatalogSnapshot {
    const agent = this.activeAgent();
    if (agent === undefined) return Object.freeze({ tools: Object.freeze([]) });
    const schemas = this.tools.schemas(agent);
    const catalog = schemas
      .map(projectTool)
      .sort((left, right) => left.name.localeCompare(right.name));
    return Object.freeze({ tools: Object.freeze(catalog) });
  }

  private refresh(): void {
    this.snapshot = this.readSnapshot();
    for (const listener of this.listeners) listener();
  }
}
