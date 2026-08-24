/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { StreamingState } from '../../types.js';

export interface TurnActivityStatus {
  operationStartTime: number;
}

/**
 * Monitors turn activity to detect when a new operation starts.
 */
export const useTurnActivityMonitor = (
  streamingState: StreamingState,
  activePtyId: number | string | null | undefined,
): TurnActivityStatus => {
  const [operationStartTime, setOperationStartTime] = useState(0);

  // Reset operation start time whenever a new operation begins.
  // We consider an operation to have started when we enter Responding state,
  // OR when the active PTY changes (meaning a new command started within the turn).
  const prevPtyIdRef = useRef<number | string | null | undefined>(undefined);
  const prevStreamingStateRef = useRef<StreamingState | undefined>(undefined);

  useEffect(() => {
    const isNowResponding = streamingState === StreamingState.Responding;
    const wasResponding =
      prevStreamingStateRef.current === StreamingState.Responding;
    const ptyChanged = activePtyId !== prevPtyIdRef.current;

    if (isNowResponding && (!wasResponding || ptyChanged)) {
      setOperationStartTime(Date.now());
    } else if (!isNowResponding && wasResponding) {
      setOperationStartTime(0);
    }

    prevPtyIdRef.current = activePtyId;
    prevStreamingStateRef.current = streamingState;
  }, [streamingState, activePtyId]);

  return {
    operationStartTime,
  };
};
