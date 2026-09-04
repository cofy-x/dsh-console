/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { getBoundingBox, type DOMElement } from 'ink';
import type React from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from '../../terminal/mouse.js';
import { MOUSE_EVENT_PRIORITY, useMouse } from '../contexts/mouse-context.js';

export interface UseMouseHoverOptions {
  isActive?: boolean;
  priority?: number;
  onHoverChange?: (hovered: boolean) => void;
}

/** Tracks passive mouse entry and exit for an Ink element. */
export function useMouseHover(
  ref: React.RefObject<DOMElement | null>,
  {
    isActive = true,
    priority = MOUSE_EVENT_PRIORITY.interactive,
    onHoverChange,
  }: UseMouseHoverOptions = {},
): boolean {
  const [hovered, setHovered] = useState(false);
  const hoveredRef = useRef(false);
  const onHoverChangeRef = useRef(onHoverChange);
  onHoverChangeRef.current = onHoverChange;

  const updateHovered = useCallback((nextHovered: boolean) => {
    if (hoveredRef.current === nextHovered) return;

    hoveredRef.current = nextHovered;
    setHovered(nextHovered);
    onHoverChangeRef.current?.(nextHovered);
  }, []);

  const handleMouse = useCallback(
    (event: MouseEvent) => {
      if (event.name !== 'move') return false;

      const element = ref.current;
      if (element === null) {
        updateHovered(false);
        return false;
      }

      const { x, y, width, height } = getBoundingBox(element);
      const mouseX = event.col - 1;
      const mouseY = event.row - 1;
      const isInside =
        mouseX >= x && mouseX < x + width && mouseY >= y && mouseY < y + height;

      updateHovered(isInside);
      return isInside;
    },
    [ref, updateHovered],
  );

  useMouse(handleMouse, {
    isActive,
    priority,
    trackingMode: 'any-motion',
  });

  useLayoutEffect(() => {
    if (!isActive) updateHovered(false);
  }, [isActive, updateHovered]);

  return hovered;
}
