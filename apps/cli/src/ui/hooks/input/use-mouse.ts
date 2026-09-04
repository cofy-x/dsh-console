/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import type {
  MouseHandler,
  MouseEvent,
  MouseTrackingMode,
} from '../../../terminal/mouse.js';
import {
  MOUSE_EVENT_PRIORITY,
  useMouseContext,
} from '../../contexts/mouse-context.js';

export type { MouseEvent };

/**
 * A hook that listens for mouse events from stdin.
 *
 * @param onMouseEvent - The callback function to execute on each mouse event.
 * @param options - Options to control the hook's behavior.
 * @param options.isActive - Whether the hook should be actively listening for input.
 */
export function useMouse(
  onMouseEvent: MouseHandler,
  {
    isActive,
    priority = MOUSE_EVENT_PRIORITY.content,
    trackingMode = 'button-motion',
  }: {
    isActive: boolean;
    priority?: number;
    trackingMode?: MouseTrackingMode;
  },
) {
  const { subscribe, unsubscribe } = useMouseContext();

  useEffect(() => {
    if (!isActive) {
      return;
    }

    subscribe(onMouseEvent, { priority, trackingMode });
    return () => {
      unsubscribe(onMouseEvent);
    };
  }, [isActive, onMouseEvent, priority, subscribe, trackingMode, unsubscribe]);
}
