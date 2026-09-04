/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getBoundingBox, type DOMElement } from 'ink';
import type React from 'react';
import {
  useMouse,
  type MouseEvent,
  type MouseEventName,
} from '../../contexts/mouse-context.js';
import { useCallback, useRef } from 'react';

export const useMouseClick = (
  containerRef: React.RefObject<DOMElement | null>,
  handler: (event: MouseEvent, relativeX: number, relativeY: number) => void,
  options: {
    isActive?: boolean;
    button?: 'left' | 'right';
    name?: MouseEventName;
    priority?: number;
  } = {},
) => {
  const { isActive = true, button = 'left', name, priority } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const onMouse = useCallback(
    (event: MouseEvent) => {
      const eventName =
        name ?? (button === 'left' ? 'left-press' : 'right-release');
      if (event.name === eventName && containerRef.current) {
        const { x, y, width, height } = getBoundingBox(containerRef.current);
        // Terminal mouse events are 1-based, Ink layout is 0-based.
        const mouseX = event.col - 1;
        const mouseY = event.row - 1;

        const relativeX = mouseX - x;
        const relativeY = mouseY - y;

        if (
          relativeX >= 0 &&
          relativeX < width &&
          relativeY >= 0 &&
          relativeY < height
        ) {
          handlerRef.current(event, relativeX, relativeY);
          return true;
        }
      }
      return false;
    },
    [containerRef, button, name],
  );

  useMouse(onMouse, { isActive, priority });
};
