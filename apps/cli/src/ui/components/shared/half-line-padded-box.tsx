/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo } from 'react';
import { Box, Text, useIsScreenReaderEnabled } from 'ink';
import { useUIState } from '../../contexts/ui-state-context.js';

import { isLowColorDepth } from '../../../terminal/utils.js';
import {
  getSafeLowColorBackground,
  interpolateColor,
  resolveColor,
} from '../../theme/utils.js';

// Keep this object stable: Ink 6.4 reapplies changed border styles separately
// from unchanged borderTop/borderBottom flags during incremental updates.
const SIDE_PADDING_BORDER = {
  topLeft: ' ',
  top: ' ',
  topRight: ' ',
  left: '█',
  right: '█',
  bottomLeft: ' ',
  bottom: ' ',
  bottomRight: ' ',
};

export interface HalfLinePaddedBoxProps {
  /**
   * The base color to blend with the terminal background.
   */
  backgroundBaseColor: string;

  /**
   * The opacity (0-1) for blending the backgroundBaseColor onto the terminal background.
   */
  backgroundOpacity: number;

  /**
   * Whether to render the solid background color.
   */
  useBackgroundColor?: boolean;

  /** Paint one column of side padding as foreground blocks. */
  paintSidePadding?: boolean;

  children: React.ReactNode;
}

/**
 * A container component that renders a solid background with half-line padding
 * at the top and bottom using block characters (▀/▄).
 */
export const HalfLinePaddedBox: React.FC<HalfLinePaddedBoxProps> = (props) => {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  if (
    props.useBackgroundColor === false ||
    isScreenReaderEnabled ||
    process.env['NO_COLOR']
  ) {
    return <>{props.children}</>;
  }

  return <HalfLinePaddedBoxInternal {...props} />;
};

const HalfLinePaddedBoxInternal: React.FC<HalfLinePaddedBoxProps> = ({
  backgroundBaseColor,
  backgroundOpacity,
  children,
  paintSidePadding = false,
}) => {
  const { terminalWidth, terminalBackgroundColor } = useUIState();
  const terminalBg = terminalBackgroundColor || 'black';

  const isLowColor = isLowColorDepth();

  const backgroundColor = useMemo(() => {
    // Interpolated background colors often look bad in 256-color terminals
    if (isLowColor) {
      return getSafeLowColorBackground(terminalBg);
    }

    const resolvedBase =
      resolveColor(backgroundBaseColor) || backgroundBaseColor;
    const resolvedTerminalBg = resolveColor(terminalBg) || terminalBg;

    return interpolateColor(
      resolvedTerminalBg,
      resolvedBase,
      backgroundOpacity,
    );
  }, [backgroundBaseColor, backgroundOpacity, terminalBg, isLowColor]);

  if (!backgroundColor) {
    return <>{children}</>;
  }

  // Paint the padding directly, leaving its outer half on the terminal's
  // native background instead of covering a filled row with a guessed color.
  return (
    <Box
      width={terminalWidth}
      flexDirection="column"
      alignItems="stretch"
      minHeight={1}
      flexShrink={0}
    >
      <Box width={terminalWidth} flexDirection="row">
        <Text color={backgroundColor}>{'▄'.repeat(terminalWidth)}</Text>
      </Box>
      <Box
        key={paintSidePadding ? 'painted-padding' : 'background-padding'}
        width={terminalWidth}
        flexDirection="column"
        alignItems="stretch"
        backgroundColor={backgroundColor}
        borderTop={false}
        borderBottom={false}
        // iTerm2 extends edge-cell backgrounds into window margins in alternate
        // screen mode. Foreground blocks fill the padding without triggering it.
        borderStyle={paintSidePadding ? SIDE_PADDING_BORDER : undefined}
        borderColor={backgroundColor}
      >
        {children}
      </Box>
      <Box width={terminalWidth} flexDirection="row">
        <Text color={backgroundColor}>{'▀'.repeat(terminalWidth)}</Text>
      </Box>
    </Box>
  );
};
