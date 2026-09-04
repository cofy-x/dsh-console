/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { ThemedGradient } from '../shared/themed-gradient.js';
import { compactDshLogo, tinyDshLogo } from '../../theme/ascii.js';
import { getAsciiArtWidth } from '../../../text/processing.js';
import { useSnowfall } from '../../hooks/visual/use-snow-fall.js';
import { InteractiveRegion } from '../shared/interactive-region.js';

interface VerticalHeaderProps {
  art?: string;
  customAsciiArt?: string;
  terminalWidth: number;
  version: string;
  nightly: boolean;
  showVersion?: boolean;
  onShufflePokemon?: () => void;
}

/**
 * Vertical header layout with stacked content.
 * Displays the ASCII logo with responsive sizing based on terminal width.
 */
export const VerticalHeader: React.FC<VerticalHeaderProps> = ({
  customAsciiArt,
  art,
  terminalWidth,
  version,
  nightly,
  showVersion = false,
  onShufflePokemon,
}) => {
  let displayTitle;
  const selectedArtWidth = art ? getAsciiArtWidth(art) : 0;
  const compactLogoWidth = getAsciiArtWidth(compactDshLogo);

  if (customAsciiArt) {
    displayTitle = customAsciiArt;
  } else if (art && terminalWidth >= selectedArtWidth) {
    displayTitle = art;
  } else if (art) {
    displayTitle = tinyDshLogo;
  } else if (terminalWidth >= compactLogoWidth) {
    displayTitle = compactDshLogo;
  } else {
    displayTitle = tinyDshLogo;
  }

  const artWidth = getAsciiArtWidth(displayTitle);
  const decoratedTitle = useSnowfall(displayTitle, terminalWidth);
  const isSelectedArt = art !== undefined && displayTitle === art;
  const title = isSelectedArt ? displayTitle : decoratedTitle;
  const canShuffleDisplayedArt =
    onShufflePokemon !== undefined && isSelectedArt;

  return (
    <Box
      alignItems="flex-start"
      width={artWidth}
      flexShrink={0}
      flexDirection="column"
    >
      {canShuffleDisplayedArt ? (
        <InteractiveRegion onPress={onShufflePokemon}>
          <Text>{title}</Text>
        </InteractiveRegion>
      ) : isSelectedArt ? (
        <Text>{title}</Text>
      ) : (
        <ThemedGradient>{title}</ThemedGradient>
      )}
      {(nightly || showVersion) && (
        <Box width="100%" flexDirection="row" justifyContent="flex-end">
          <ThemedGradient>
            {nightly ? 'NIGHTLY' : ''}
            {nightly && showVersion ? ' ' : ''}
            {showVersion ? `v${version}` : ''}
          </ThemedGradient>
        </Box>
      )}
    </Box>
  );
};
