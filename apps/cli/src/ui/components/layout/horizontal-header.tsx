/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { ThemedGradient } from '../shared/themed-gradient.js';
import { theme } from '../../theme/colors.js';
import { QUOTES, STARTUP_QUESTS } from './resources/quotes.js';

interface HorizontalHeaderProps {
  version: string;
  art: string;
}

const MIN_STARTUP_PANEL_HEIGHT = 7;

/**
 * Horizontal header layout with art on the left and text on the right.
 * Used when displaying ASCII art alongside the header text.
 */
export const HorizontalHeader: React.FC<HorizontalHeaderProps> = ({
  version,
  art,
}: HorizontalHeaderProps) => {
  const randomQuote = useMemo(
    () => QUOTES[Math.floor(Math.random() * QUOTES.length)],
    [],
  );
  const startupQuest = useMemo(
    () => STARTUP_QUESTS[Math.floor(Math.random() * STARTUP_QUESTS.length)],
    [],
  );
  const artHeight = useMemo(() => art.trimEnd().split('\n').length, [art]);

  return (
    <Box flexDirection="row" paddingBottom={1} alignItems="flex-start">
      <Box paddingRight={2} marginRight={1} flexShrink={0}>
        <Text>{art}</Text>
      </Box>

      <Box
        flexDirection="column"
        justifyContent="center"
        height={Math.max(artHeight, MIN_STARTUP_PANEL_HEIGHT)}
        flexGrow={1}
        flexShrink={1}
      >
        <Box marginBottom={1} flexDirection="row">
          <Box flexShrink={0}>
            <Text bold color={theme.text.primary}>
              <ThemedGradient>DSH CONSOLE</ThemedGradient>{' '}
            </Text>
            <Text color="dim">v{version}</Text>
            <Text color="gray"> | </Text>
          </Box>
          <Box flexShrink={1}>
            <Text italic color={theme.text.secondary} wrap="truncate-end">
              {randomQuote}
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text bold color={theme.text.primary}>
            TODAY&apos;S QUEST
          </Text>
          <Text>
            <Text color={theme.text.link}>{'  › '}</Text>
            <Text color={theme.text.secondary}>{startupQuest[0]}</Text>
          </Text>
          <Text>
            <Text color={theme.text.link}>{'  › '}</Text>
            <Text color={theme.text.secondary}>{startupQuest[1]}</Text>
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color={theme.text.link}>/new</Text>
          <Text color={theme.text.secondary}> Fresh start</Text>
          <Text color={theme.text.secondary}> · </Text>
          <Text color={theme.text.link}>/sessions</Text>
          <Text color={theme.text.secondary}> Continue</Text>
          <Text color={theme.text.secondary}> · </Text>
          <Text color={theme.text.link}>/help</Text>
          <Text color={theme.text.secondary}> Explore</Text>
        </Box>
      </Box>
    </Box>
  );
};
