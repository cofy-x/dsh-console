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
      'changelog',
      'stats',
      'tools',
      'agents',
      'btw',
      'main',
      'side',
      'quit',
      'theme',
      'settings',
      'vim',
      'model',
      'provider',
      'permission',
      'new',
      'sessions',
    ]);
  });

  it('exposes the profiler command only for debug runtimes', async () => {
    const commands = await new BuiltinCommandLoader(true).loadCommands(
      new AbortController().signal,
    );

    expect(commands.map((command) => command.name)).toContain('profiler');
  });
});
