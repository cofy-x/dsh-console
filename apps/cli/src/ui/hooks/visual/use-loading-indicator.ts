/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StreamingState } from '../../types.js';
import { useTimer } from './use-timer.js';
import { usePhraseCycler } from './use-phrase-cycler.js';
import { useState, useEffect, useRef } from 'react';

export interface UseLoadingIndicatorProps {
  streamingState: StreamingState;
  shouldShowFocusHint: boolean;
  customWittyPhrases?: string[];
}

export const useLoadingIndicator = ({
  streamingState,
  shouldShowFocusHint,
  customWittyPhrases,
}: UseLoadingIndicatorProps) => {
  const [timerResetKey, setTimerResetKey] = useState(0);
  const isTimerActive = streamingState === StreamingState.Responding;

  const elapsedTimeFromTimer = useTimer(isTimerActive, timerResetKey);

  const isPhraseCyclingActive = streamingState === StreamingState.Responding;
  const currentLoadingPhrase = usePhraseCycler(
    isPhraseCyclingActive,
    shouldShowFocusHint,
    customWittyPhrases,
  );

  const prevStreamingStateRef = useRef<StreamingState | null>(null);

  useEffect(() => {
    if (
      streamingState === StreamingState.Idle &&
      prevStreamingStateRef.current === StreamingState.Responding
    ) {
      setTimerResetKey((prevKey) => prevKey + 1); // Reset timer when becoming idle from responding
    }

    prevStreamingStateRef.current = streamingState;
  }, [streamingState, elapsedTimeFromTimer]);

  return {
    elapsedTime: elapsedTimeFromTimer,
    currentLoadingPhrase,
  };
};
