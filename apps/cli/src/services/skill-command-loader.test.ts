/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import type { SkillCatalogRuntime } from '../ui/skill-catalog-runtime.js';
import { CommandKind } from '../ui/commands/types.js';
import { SkillCommandLoader } from './skill-command-loader.js';

describe('SkillCommandLoader', () => {
  it('projects Skills as non-command Slash candidates', async () => {
    const runtime: SkillCatalogRuntime = {
      getSnapshot: () => ({
        status: 'ready',
        skills: [
          {
            name: 'review-work',
            description: 'Review the current work',
            modelInvocable: false,
          },
        ],
      }),
      subscribe: () => vi.fn(),
      prepare: vi.fn(async () => undefined),
    };
    await expect(
      new SkillCommandLoader(runtime).loadCommands(
        new AbortController().signal,
      ),
    ).resolves.toMatchObject([
      {
        name: 'review-work',
        kind: CommandKind.SKILL,
        autoExecute: false,
        recordInvocation: false,
      },
    ]);
  });
});
