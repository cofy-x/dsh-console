/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useInput, type Key } from 'ink';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { debugLogger } from '@cofy-x/dsh-console-core';
import { appEvents, AppEvent } from '../../utils/events.js';
import {
  DOUBLE_CLICK_DISTANCE_TOLERANCE,
  DOUBLE_CLICK_THRESHOLD_MS,
  disableMouseEvents,
  enableMouseEvents,
  isIncompleteMouseSequence,
  parseMouseEvent,
  type MouseEvent,
  type MouseEventName,
  type MouseHandler,
  type MouseTrackingMode,
} from '../../terminal/mouse.js';
import { ESC } from '../../terminal/input-parser.js';

export type { MouseEvent, MouseEventName, MouseHandler };

const MAX_MOUSE_BUFFER_SIZE = 4096;

export interface MouseSubscriptionOptions {
  priority?: number;
  trackingMode?: MouseTrackingMode;
}

interface MouseContextValue {
  subscribe: (
    handler: MouseHandler,
    options?: MouseSubscriptionOptions,
  ) => void;
  unsubscribe: (handler: MouseHandler) => void;
  mouseEventsEnabled: boolean;
}

interface MouseSubscription {
  handler: MouseHandler;
  priority: number;
  trackingMode: MouseTrackingMode;
  order: number;
}

export const MOUSE_EVENT_PRIORITY = {
  content: 0,
  interactive: 10,
  dialog: 100,
} as const;

const MouseContext = createContext<MouseContextValue | undefined>(undefined);

export function useMouseContext() {
  const context = useContext(MouseContext);
  if (!context) {
    throw new Error('useMouseContext must be used within a MouseProvider');
  }
  return context;
}

export function useMouse(
  handler: MouseHandler,
  {
    isActive = true,
    priority = MOUSE_EVENT_PRIORITY.content,
    trackingMode = 'button-motion',
  }: {
    isActive?: boolean;
    priority?: number;
    trackingMode?: MouseTrackingMode;
  } = {},
) {
  const context = useContext(MouseContext);

  // Mouse subscriptions must exist in the same commit that makes their Ink
  // regions visible. A passive effect leaves a painted-frame window where the
  // first pointer movement is lost and hover appears to start after a click.
  useLayoutEffect(() => {
    if (!isActive || !context) {
      return;
    }

    context.subscribe(handler, { priority, trackingMode });
    return () => context.unsubscribe(handler);
  }, [context, handler, isActive, priority, trackingMode]);
}

export function MouseProvider({
  children,
  mouseEventsEnabled,
  manageTerminalMode = true,
  debugKeystrokeLogging,
}: {
  children: React.ReactNode;
  mouseEventsEnabled?: boolean;
  manageTerminalMode?: boolean;
  debugKeystrokeLogging?: boolean;
}) {
  const subscribers = useRef<Map<MouseHandler, MouseSubscription>>(
    new Map(),
  ).current;
  const nextSubscriptionOrderRef = useRef(0);
  const mouseInputReadyRef = useRef(false);
  const mouseBufferRef = useRef('');
  const appliedTrackingModeRef = useRef<MouseTrackingMode | undefined>(
    undefined,
  );
  const lastClickRef = useRef<{
    time: number;
    col: number;
    row: number;
  } | null>(null);

  const synchronizeTerminalMode = useCallback(() => {
    if (
      !mouseEventsEnabled ||
      !manageTerminalMode ||
      !mouseInputReadyRef.current
    ) {
      return;
    }

    const requestedMode: MouseTrackingMode = [...subscribers.values()].some(
      ({ trackingMode }) => trackingMode === 'any-motion',
    )
      ? 'any-motion'
      : 'button-motion';
    if (appliedTrackingModeRef.current === requestedMode) return;

    enableMouseEvents(requestedMode);
    appliedTrackingModeRef.current = requestedMode;
  }, [manageTerminalMode, mouseEventsEnabled, subscribers]);

  const subscribe = useCallback(
    (handler: MouseHandler, options: MouseSubscriptionOptions = {}) => {
      const {
        priority = MOUSE_EVENT_PRIORITY.content,
        trackingMode = 'button-motion',
      } = options;
      subscribers.set(handler, {
        handler,
        priority,
        trackingMode,
        order: nextSubscriptionOrderRef.current++,
      });
      synchronizeTerminalMode();
    },
    [subscribers, synchronizeTerminalMode],
  );

  const unsubscribe = useCallback(
    (handler: MouseHandler) => {
      if (subscribers.delete(handler)) synchronizeTerminalMode();
    },
    [subscribers, synchronizeTerminalMode],
  );

  const broadcast = useCallback(
    (event: MouseEvent) => {
      const orderedSubscribers = [...subscribers.values()].sort(
        (left, right) =>
          right.priority - left.priority || left.order - right.order,
      );
      let handled = false;
      let handledPriority: number | undefined;
      for (const { handler, priority } of orderedSubscribers) {
        if (
          event.name === 'move' &&
          handledPriority !== undefined &&
          priority < handledPriority
        ) {
          break;
        }
        if (handler(event) === true) {
          handled = true;
          if (event.name !== 'move') break;
          handledPriority ??= priority;
        }
      }

      if (event.name === 'left-press') {
        const now = Date.now();
        const lastClick = lastClickRef.current;
        if (
          lastClick &&
          now - lastClick.time < DOUBLE_CLICK_THRESHOLD_MS &&
          Math.abs(event.col - lastClick.col) <=
            DOUBLE_CLICK_DISTANCE_TOLERANCE &&
          Math.abs(event.row - lastClick.row) <= DOUBLE_CLICK_DISTANCE_TOLERANCE
        ) {
          const doubleClickEvent: MouseEvent = {
            ...event,
            name: 'double-click',
          };
          for (const { handler } of orderedSubscribers) {
            if (handler(doubleClickEvent) === true) break;
          }
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { time: now, col: event.col, row: event.row };
        }
      }

      if (
        !handled &&
        event.name === 'move' &&
        event.col >= 0 &&
        event.row >= 0 &&
        event.button === 'left'
      ) {
        // A left-button move is a drag that the user may have expected to
        // trigger native terminal selection. Passive hover reports no button.
        appEvents.emit(AppEvent.SelectionWarning);
      }
    },
    [subscribers],
  );

  const handleData = useCallback(
    (data: string) => {
      mouseBufferRef.current += data;

      // Safety cap to prevent infinite buffer growth on garbage
      if (mouseBufferRef.current.length > MAX_MOUSE_BUFFER_SIZE) {
        mouseBufferRef.current = mouseBufferRef.current.slice(
          -MAX_MOUSE_BUFFER_SIZE,
        );
      }

      while (mouseBufferRef.current.length > 0) {
        const parsed = parseMouseEvent(mouseBufferRef.current);

        if (parsed) {
          if (debugKeystrokeLogging) {
            debugLogger.log(
              '[DEBUG] Mouse event parsed:',
              JSON.stringify(parsed.event),
            );
          }
          broadcast(parsed.event);
          mouseBufferRef.current = mouseBufferRef.current.slice(parsed.length);
          continue;
        }

        if (isIncompleteMouseSequence(mouseBufferRef.current)) {
          break; // Wait for more data
        }

        // Not a valid sequence at start, and not waiting for more data.
        // Discard garbage until next possible sequence start.
        const nextEsc = mouseBufferRef.current.indexOf(ESC, 1);
        if (nextEsc !== -1) {
          mouseBufferRef.current = mouseBufferRef.current.slice(nextEsc);
          // Loop continues to try parsing at new location
        } else {
          mouseBufferRef.current = '';
          break;
        }
      }
    },
    [broadcast, debugKeystrokeLogging],
  );

  const handleInkInput = useCallback(
    (input: string, key: Key) => {
      let data = input;
      if (mouseBufferRef.current.length === 0) {
        if (key.escape && input.length === 0) {
          data = ESC;
        } else if (input.startsWith('[<') || input.startsWith('[M')) {
          // Ink removes the leading escape before invoking useInput.
          data = `${ESC}${input}`;
        }
      }
      handleData(data);
    },
    [handleData],
  );

  // useInput invokes callbacks inside Ink's reconciler.batchedUpdates. Raw
  // stdin listeners leave React state queued until an unrelated key or click
  // happens to flush the renderer, which makes hover appear click-activated.
  useInput(handleInkInput, { isActive: mouseEventsEnabled === true });

  useEffect(() => {
    if (!mouseEventsEnabled) return;

    // This effect runs after useInput installs Ink's input listener, so the
    // first passive report cannot race ahead of the renderer update boundary.
    mouseInputReadyRef.current = true;
    synchronizeTerminalMode();

    return () => {
      mouseInputReadyRef.current = false;
      mouseBufferRef.current = '';
      appliedTrackingModeRef.current = undefined;
      if (manageTerminalMode) disableMouseEvents();
    };
  }, [mouseEventsEnabled, manageTerminalMode, synchronizeTerminalMode]);

  const contextValue = useMemo(
    () => ({
      subscribe,
      unsubscribe,
      mouseEventsEnabled: mouseEventsEnabled === true,
    }),
    [mouseEventsEnabled, subscribe, unsubscribe],
  );

  return (
    <MouseContext.Provider value={contextValue}>
      {children}
    </MouseContext.Provider>
  );
}
