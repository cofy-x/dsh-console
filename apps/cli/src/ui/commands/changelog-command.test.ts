/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createChangelogCommand } from './changelog-command.js';
import type { CommandActionContext } from './types.js';

const context = {
  ui: { removeComponent: vi.fn() },
} as unknown as CommandActionContext;

describe('changelogCommand', () => {
  it('opens the packaged changelog', async () => {
    const command = createChangelogCommand(
      vi.fn().mockResolvedValue('# Changelog\n\n## Unreleased'),
    );
    await expect(command.action?.(context, '')).resolves.toMatchObject({
      type: 'custom_dialog',
    });
  });

  it('rejects arguments', async () => {
    const command = createChangelogCommand(vi.fn());
    await expect(command.action?.(context, 'latest')).resolves.toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Usage: /changelog',
    });
  });

  it('reports resource loading failures', async () => {
    const command = createChangelogCommand(
      vi.fn().mockRejectedValue(new Error('missing resource')),
    );
    const result = await command.action?.(context, '');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'Could not load the changelog: missing resource',
    });
  });
});
