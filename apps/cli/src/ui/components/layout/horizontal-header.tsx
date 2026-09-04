/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { ThemedGradient } from '../shared/themed-gradient.js';
import { theme } from '../../theme/colors.js';
import { QUOTES } from './resources/quotes.js';
import { StartupActions } from './startup-actions.js';
import { InteractiveRegion } from '../shared/interactive-region.js';

interface HorizontalHeaderProps {
  version: string;
  nightly?: boolean;
  showVersion?: boolean;
  art: string;
  showStartupActions?: boolean;
  onShufflePokemon?: () => void;
  startupTips?: React.ReactNode;
}

const MIN_STARTUP_PANEL_HEIGHT = 7;

/**
 * Horizontal header layout with art on the left and text on the right.
 * Used when displaying ASCII art alongside the header text.
 */
export const HorizontalHeader: React.FC<HorizontalHeaderProps> = ({
  version,
  nightly = false,
  showVersion = false,
  art,
  showStartupActions = false,
  onShufflePokemon,
  startupTips,
}: HorizontalHeaderProps) => {
  const initialQuoteIndex = useMemo(
    () => Math.floor(Math.random() * QUOTES.length),
    [],
  );
  const [quoteRevision, setQuoteRevision] = useState(0);
  const randomQuote =
    QUOTES[(initialQuoteIndex + quoteRevision) % QUOTES.length];
  const handleShufflePokemon = useCallback(() => {
    setQuoteRevision((revision) => revision + 1);
    onShufflePokemon?.();
  }, [onShufflePokemon]);
  const artHeight = useMemo(() => art.trimEnd().split('\n').length, [art]);

  return (
    <Box flexDirection="row" paddingBottom={1} alignItems="flex-start">
      <Box paddingRight={2} marginRight={1} flexShrink={0}>
        {onShufflePokemon ? (
          <InteractiveRegion onPress={handleShufflePokemon}>
            <Text>{art}</Text>
          </InteractiveRegion>
        ) : (
          <Text>{art}</Text>
        )}
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
              <ThemedGradient>DSH CONSOLE</ThemedGradient>
            </Text>
            {nightly && <Text color={theme.status.warning}> NIGHTLY</Text>}
            {showVersion && <Text color="dim"> v{version}</Text>}
            <Text color="gray"> | </Text>
          </Box>
          <Box flexShrink={1}>
            <Text italic color={theme.text.secondary} wrap="truncate-end">
              {randomQuote}
            </Text>
          </Box>
        </Box>

        {startupTips}

        {showStartupActions && <StartupActions />}
      </Box>
    </Box>
  );
};
