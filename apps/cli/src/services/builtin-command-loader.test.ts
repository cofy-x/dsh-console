/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { BuiltinCommandLoader } from './builtin-command-loader.js';

describe('BuiltinCommandLoader', () => {
  it('exposes only commands supported by the DSH console runtime', async () => {
    const commands = await new BuiltinCommandLoader().loadCommands(
      new AbortController().signal,
    );

    expect(commands.map((command) => command.name)).toEqual([
      'help',
      'about',
      'stats',
      'tools',
      'profile',
      'quit',
      'theme',
      'settings',
      'vim',
      'terminal-setup',
      'model',
      'new',
      'sessions',
      'resume',
    ]);
  });
});
