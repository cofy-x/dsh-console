/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '../../../test-utils/render.js';
import { waitFor } from '../../../test-utils/async.js';
import type { CommandContext, SlashCommand } from '../../commands/types.js';
import { CommandKind } from '../../commands/types.js';
import type { Suggestion } from '../../components/input/suggestions-display.js';
import { useSlashCompletion } from './use-slash-completion.js';

const commandContext = {} as CommandContext;

function useSuggestions(
  query: string,
  slashCommands: readonly SlashCommand[],
): Suggestion[] {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [, setIsLoadingSuggestions] = useState(false);
  const [, setIsPerfectMatch] = useState(false);

  useSlashCompletion({
    enabled: true,
    query,
    slashCommands,
    commandContext,
    setSuggestions,
    setIsLoadingSuggestions,
    setIsPerfectMatch,
  });

  return suggestions;
}

describe('useSlashCompletion with real fzf', () => {
  it('retains fuzzy matching when no command has the requested prefix', async () => {
    const slashCommands: SlashCommand[] = [
      {
        name: 'compact',
        description: 'Compact older conversation history',
        kind: CommandKind.DSH,
      },
      {
        name: 'feedback',
        description: 'Record feedback about this session',
        kind: CommandKind.DSH,
      },
    ];

    const { result, unmount } = renderHook(() =>
      useSuggestions('/cpt', slashCommands),
    );

    await waitFor(() => {
      expect(result.current).toEqual([
        {
          label: 'compact',
          value: 'compact',
          description: 'Compact older conversation history',
          commandKind: CommandKind.DSH,
        },
      ]);
    });
    unmount();
  });
});
