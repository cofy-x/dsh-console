/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box } from 'ink';
import { ThemedGradient } from '../shared/themed-gradient.js';
import { compactDshLogo, tinyDshLogo } from '../../theme/ascii.js';
import { getAsciiArtWidth } from '../../../text/processing.js';
import { useSnowfall } from '../../hooks/visual/use-snow-fall.js';

interface VerticalHeaderProps {
  art?: string;
  customAsciiArt?: string;
  terminalWidth: number;
  version: string;
  nightly: boolean;
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
}) => {
  let displayTitle;
  const selectedArtWidth = art ? getAsciiArtWidth(art) : 0;
  const compactLogoWidth = getAsciiArtWidth(compactDshLogo);

  if (customAsciiArt) {
    displayTitle = customAsciiArt;
  } else if (art && terminalWidth >= selectedArtWidth) {
    displayTitle = art;
  } else if (terminalWidth >= compactLogoWidth) {
    displayTitle = compactDshLogo;
  } else {
    displayTitle = tinyDshLogo;
  }

  const artWidth = getAsciiArtWidth(displayTitle);
  const title = useSnowfall(displayTitle, terminalWidth);

  return (
    <Box
      alignItems="flex-start"
      width={artWidth}
      flexShrink={0}
      flexDirection="column"
    >
      <ThemedGradient>{title}</ThemedGradient>
      {nightly && (
        <Box width="100%" flexDirection="row" justifyContent="flex-end">
          <ThemedGradient>v{version}</ThemedGradient>
        </Box>
      )}
    </Box>
  );
};
