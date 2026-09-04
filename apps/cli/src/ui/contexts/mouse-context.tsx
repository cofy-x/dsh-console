/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useStdin } from 'ink';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
} from '../../terminal/mouse.js';
import { ESC } from '../../terminal/input-parser.js';

export type { MouseEvent, MouseEventName, MouseHandler };

const MAX_MOUSE_BUFFER_SIZE = 4096;

interface MouseContextValue {
  subscribe: (handler: MouseHandler, priority?: number) => void;
  unsubscribe: (handler: MouseHandler) => void;
  mouseEventsEnabled: boolean;
}

interface MouseSubscription {
  handler: MouseHandler;
  priority: number;
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
  }: { isActive?: boolean; priority?: number } = {},
) {
  const context = useContext(MouseContext);

  useEffect(() => {
    if (!isActive || !context) {
      return;
    }

    context.subscribe(handler, priority);
    return () => context.unsubscribe(handler);
  }, [context, handler, isActive, priority]);
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
  const { stdin } = useStdin();
  const subscribers = useRef<Map<MouseHandler, MouseSubscription>>(
    new Map(),
  ).current;
  const nextSubscriptionOrderRef = useRef(0);
  const lastClickRef = useRef<{
    time: number;
    col: number;
    row: number;
  } | null>(null);

  const subscribe = useCallback(
    (
      handler: MouseHandler,
      priority: number = MOUSE_EVENT_PRIORITY.content,
    ) => {
      subscribers.set(handler, {
        handler,
        priority,
        order: nextSubscriptionOrderRef.current++,
      });
    },
    [subscribers],
  );

  const unsubscribe = useCallback(
    (handler: MouseHandler) => {
      subscribers.delete(handler);
    },
    [subscribers],
  );

  useEffect(() => {
    if (!mouseEventsEnabled) {
      return;
    }

    let mouseBuffer = '';

    const broadcast = (event: MouseEvent) => {
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
    };

    const handleData = (data: Buffer | string) => {
      mouseBuffer += typeof data === 'string' ? data : data.toString('utf-8');

      // Safety cap to prevent infinite buffer growth on garbage
      if (mouseBuffer.length > MAX_MOUSE_BUFFER_SIZE) {
        mouseBuffer = mouseBuffer.slice(-MAX_MOUSE_BUFFER_SIZE);
      }

      while (mouseBuffer.length > 0) {
        const parsed = parseMouseEvent(mouseBuffer);

        if (parsed) {
          if (debugKeystrokeLogging) {
            debugLogger.log(
              '[DEBUG] Mouse event parsed:',
              JSON.stringify(parsed.event),
            );
          }
          broadcast(parsed.event);
          mouseBuffer = mouseBuffer.slice(parsed.length);
          continue;
        }

        if (isIncompleteMouseSequence(mouseBuffer)) {
          break; // Wait for more data
        }

        // Not a valid sequence at start, and not waiting for more data.
        // Discard garbage until next possible sequence start.
        const nextEsc = mouseBuffer.indexOf(ESC, 1);
        if (nextEsc !== -1) {
          mouseBuffer = mouseBuffer.slice(nextEsc);
          // Loop continues to try parsing at new location
        } else {
          mouseBuffer = '';
          break;
        }
      }
    };

    stdin.on('data', handleData);
    if (manageTerminalMode) enableMouseEvents();

    return () => {
      stdin.removeListener('data', handleData);
      if (manageTerminalMode) disableMouseEvents();
    };
  }, [
    stdin,
    mouseEventsEnabled,
    manageTerminalMode,
    subscribers,
    debugKeystrokeLogging,
  ]);

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
