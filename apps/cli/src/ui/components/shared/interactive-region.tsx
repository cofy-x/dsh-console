/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, type DOMElement } from 'ink';
import type React from 'react';
import { useRef } from 'react';
import { useMouseClick } from '../../hooks/input/use-mouse-click.js';
import { MOUSE_EVENT_PRIORITY } from '../../contexts/mouse-context.js';

export interface InteractiveRegionProps extends Omit<
  React.ComponentProps<typeof Box>,
  'children' | 'ref'
> {
  onPress: () => void;
  isActive?: boolean;
  mousePriority?: number;
  children: React.ReactNode;
}

/**
 * Adds terminal mouse activation to an existing Ink layout region without
 * introducing a second action path or prescribing visual styling.
 */
export function InteractiveRegion({
  onPress,
  isActive = true,
  mousePriority = MOUSE_EVENT_PRIORITY.interactive,
  children,
  ...boxProps
}: InteractiveRegionProps): React.JSX.Element {
  const ref = useRef<DOMElement>(null);

  useMouseClick(ref, onPress, {
    isActive,
    priority: mousePriority,
  });

  return (
    <Box ref={ref} {...boxProps}>
      {children}
    </Box>
  );
}
