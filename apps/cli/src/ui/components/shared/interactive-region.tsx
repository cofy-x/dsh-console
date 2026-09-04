/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, type DOMElement } from 'ink';
import type React from 'react';
import { useRef } from 'react';
import { useMouseClick } from '../../hooks/input/use-mouse-click.js';
import { useMouseHover } from '../../hooks/use-mouse-hover.js';
import { MOUSE_EVENT_PRIORITY } from '../../contexts/mouse-context.js';

export interface InteractiveRegionState {
  hovered: boolean;
}

export interface InteractiveRegionProps extends Omit<
  React.ComponentProps<typeof Box>,
  'children' | 'ref'
> {
  onPress: () => void;
  isActive?: boolean;
  mousePriority?: number;
  onHoverChange?: (hovered: boolean) => void;
  children:
    | React.ReactNode
    | ((state: InteractiveRegionState) => React.ReactNode);
}

/**
 * Adds terminal mouse activation to an existing Ink layout region without
 * introducing a second action path or prescribing visual styling.
 */
export function InteractiveRegion({
  onPress,
  isActive = true,
  mousePriority = MOUSE_EVENT_PRIORITY.interactive,
  onHoverChange,
  children,
  ...boxProps
}: InteractiveRegionProps): React.JSX.Element {
  const ref = useRef<DOMElement>(null);

  useMouseClick(ref, onPress, {
    isActive,
    priority: mousePriority,
  });
  const tracksHover =
    typeof children === 'function' || onHoverChange !== undefined;
  const hovered = useMouseHover(ref, {
    isActive: isActive && tracksHover,
    priority: mousePriority,
    onHoverChange,
  });

  return (
    <Box ref={ref} {...boxProps}>
      {typeof children === 'function' ? children({ hovered }) : children}
    </Box>
  );
}
