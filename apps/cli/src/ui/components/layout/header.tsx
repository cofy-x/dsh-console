/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { VerticalHeader } from './vertical-header.js';
import { HorizontalHeader } from './horizontal-header.js';
import type { HeaderArt } from '../../../utils/header-loader.js';
import { Box } from 'ink';
import { Tips } from '../help/tips.js';
import { getAsciiArtWidth } from '../../../text/processing.js';
import { useTips } from '../../hooks/visual/use-tips.js';

export type HeaderLayout = 'horizontal' | 'vertical';

const MIN_HORIZONTAL_CONTENT_WIDTH = 58;

const InitialTips = () => {
  const { showTips } = useTips();
  return showTips ? <Tips /> : null;
};

interface HeaderProps {
  nightly: boolean;
  version: string;
  layout: HeaderLayout;
  terminalWidth: number;
  headerArt: HeaderArt | null;
  hideTips: boolean;
  customAsciiArt?: string;
}

/**
 * Header router component that renders either horizontal or vertical layout.
 * The layout is determined by the layout prop from settings.
 */
export const Header: React.FC<HeaderProps> = ({
  nightly,
  version,
  layout,
  terminalWidth,
  headerArt,
  hideTips,
  customAsciiArt,
}) => {
  const artWidth = headerArt ? getAsciiArtWidth(headerArt.art) : 0;
  const hasHorizontalSpace =
    terminalWidth >= artWidth + MIN_HORIZONTAL_CONTENT_WIDTH;

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
          nightly={nightly}
          terminalWidth={terminalWidth}
          art={headerArt?.art}
          customAsciiArt={customAsciiArt}
        />
        {!hideTips && <InitialTips />}
      </Box>
    );
  }

  return <HorizontalHeader version={version} art={headerArt.art} />;
};
