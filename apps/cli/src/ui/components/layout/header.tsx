/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import { VerticalHeader } from './vertical-header.js';
import { HorizontalHeader } from './horizontal-header.js';
import type { HeaderArt } from '../../../utils/header-loader.js';
import { Box } from 'ink';
import { createTipsRotationSeed, Tips } from '../help/tips.js';
import { getAsciiArtWidth } from '../../../text/processing.js';
import { StartupActions } from './startup-actions.js';

export type HeaderLayout = 'horizontal' | 'vertical';

export const MIN_HORIZONTAL_CONTENT_WIDTH = 58;

interface HeaderProps {
  nightly: boolean;
  version: string;
  showVersion: boolean;
  layout: HeaderLayout;
  terminalWidth: number;
  headerArt: HeaderArt | null;
  hideTips: boolean;
  customAsciiArt?: string;
  showStartupActions?: boolean;
  onShufflePokemon?: () => void;
}

/**
 * Header router component that renders either horizontal or vertical layout.
 * The layout is determined by the layout prop from settings.
 */
export const Header: React.FC<HeaderProps> = ({
  nightly,
  version,
  showVersion,
  layout,
  terminalWidth,
  headerArt,
  hideTips,
  customAsciiArt,
  showStartupActions = false,
  onShufflePokemon,
}) => {
  const tipsRotationSeed = useMemo(createTipsRotationSeed, []);
  const artWidth = headerArt ? getAsciiArtWidth(headerArt.art) : 0;
  const hasHorizontalSpace =
    terminalWidth >= artWidth + MIN_HORIZONTAL_CONTENT_WIDTH;
  const isCompact = terminalWidth < MIN_HORIZONTAL_CONTENT_WIDTH;
  const showArtworkOnly =
    isCompact ||
    (layout === 'horizontal' && headerArt !== null && !hasHorizontalSpace);

  // Use vertical layout if:
  // - Layout is explicitly set to 'vertical'
  // - No header art is available for horizontal layout
  // - Custom ASCII art is provided (uses vertical layout)
  // - The selected art and startup panel cannot fit side by side
  if (
    layout === 'vertical' ||
    headerArt === null ||
    customAsciiArt ||
    !hasHorizontalSpace
  ) {
    return (
      <Box flexDirection="column">
        <VerticalHeader
          version={version}
          nightly={showArtworkOnly ? false : nightly}
          showVersion={showArtworkOnly ? false : showVersion}
          terminalWidth={terminalWidth}
          art={headerArt?.art}
          customAsciiArt={customAsciiArt}
          onShufflePokemon={onShufflePokemon}
        />
        {!hideTips && !showArtworkOnly && (
          <Tips
            rotationSeed={tipsRotationSeed}
            showPokemonShuffle={onShufflePokemon !== undefined}
          />
        )}
        {showStartupActions && !showArtworkOnly && (
          <StartupActions paddingLeft={2} />
        )}
      </Box>
    );
  }

  return (
    <HorizontalHeader
      version={version}
      nightly={nightly}
      showVersion={showVersion}
      art={headerArt.art}
      showStartupActions={showStartupActions}
      onShufflePokemon={onShufflePokemon}
      startupTips={
        !hideTips ? (
          <Tips
            rotationSeed={tipsRotationSeed}
            showPokemonShuffle={onShufflePokemon !== undefined}
          />
        ) : undefined
      }
    />
  );
};
