/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { CommandRuntime } from '@deepseek-ai/dsh-commands';
import type {
  DshCommandRuntime,
  DshCommandSnapshot,
  DshCommandResultView,
} from '../ui/command-runtime.js';

export class DshCommandRuntimeAdapter implements DshCommandRuntime {
  private readonly listeners = new Set<() => void>();
  private snapshot: DshCommandSnapshot;
  private readonly off: () => void;

  constructor(
    private readonly commands: Pick<CommandRuntime, 'list' | 'execute'>,
    private readonly activeAgent: () => Agent | undefined,
    subscribe: (listener: () => void) => () => void,
  ) {
    this.snapshot = this.readSnapshot();
    this.off = subscribe(() => this.refresh());
  }

  getSnapshot = (): DshCommandSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async execute(
    line: string,
    signal: AbortSignal,
  ): Promise<DshCommandResultView> {
    const agent = this.activeAgent();
    if (agent === undefined) {
      return {
        kind: 'error',
        text: 'Start a conversation before using DSH commands.',
      };
    }
    const execution = await this.commands.execute(
      agent,
      line,
      [],
      signal,
    );
    if (execution === undefined) {
      return { kind: 'error', text: `Unknown DSH command: ${line.trim()}` };
    }
    return {
      kind: execution.result.kind,
      ...(execution.result.text === undefined
        ? {}
        : { text: execution.result.text }),
    };
  }

  activeAgentChanged(): void {
    this.refresh();
  }

  dispose(): void {
    this.off();
    this.listeners.clear();
  }

  private readSnapshot(): DshCommandSnapshot {
    const agent = this.activeAgent();
    if (agent === undefined) return Object.freeze({ commands: Object.freeze([]) });
    return Object.freeze({
      commands: Object.freeze(
        this.commands.list(agent).map((command) =>
          Object.freeze({
            name: command.name,
            description: command.description,
            ...(command.input === undefined
              ? {}
              : { inputHint: command.input.hint }),
          }),
        ),
      ),
    });
  }

  private refresh(): void {
    this.snapshot = this.readSnapshot();
    for (const listener of this.listeners) listener();
  }
}
