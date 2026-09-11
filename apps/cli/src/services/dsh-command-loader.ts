/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DshCommandRuntime } from '../ui/command-runtime.js';
import { CommandKind, type SlashCommand } from '../ui/commands/types.js';
import type { ICommandLoader } from './types.js';

export class DshCommandLoader implements ICommandLoader {
  constructor(private readonly runtime: DshCommandRuntime) {}

  loadCommands(signal: AbortSignal): Promise<SlashCommand[]> {
    signal.throwIfAborted();
    return Promise.resolve(
      this.runtime.getSnapshot().commands.map((descriptor) => ({
        name: descriptor.name,
        description: descriptor.description,
        ...(descriptor.inputHint === undefined
          ? {}
          : { inputHint: descriptor.inputHint }),
        kind: CommandKind.DSH,
        autoExecute: descriptor.inputHint === undefined,
        action: async (context) => {
          const invocation = context.invocation;
          const result = await this.runtime.execute(
            invocation.raw,
            invocation.attachments ?? [],
            invocation.signal,
          );
          if (result.text === undefined) return;
          // Console does not project richer command/domain-event nodes yet, so
          // the dispatch result remains its only user-visible acknowledgement.
          return {
            type: 'message' as const,
            messageType: result.kind === 'error' ? 'error' : 'info',
            content: result.text,
          };
        },
      })),
    );
  }
}
