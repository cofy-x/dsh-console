/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SkillCatalogRuntime } from '../ui/skill-catalog-runtime.js';
import { CommandKind, type SlashCommand } from '../ui/commands/types.js';
import type { ICommandLoader } from './types.js';

export class SkillCommandLoader implements ICommandLoader {
  constructor(private readonly runtime: SkillCatalogRuntime) {}

  loadCommands(signal: AbortSignal): Promise<SlashCommand[]> {
    signal.throwIfAborted();
    return Promise.resolve(
      this.runtime.getSnapshot().skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        inputHint: '[request]',
        kind: CommandKind.SKILL,
        autoExecute: false,
        recordInvocation: false,
      })),
    );
  }
}
