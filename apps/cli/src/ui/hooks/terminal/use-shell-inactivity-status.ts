/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useInactivityTimer } from './use-inactivity-timer.js';
import { useTurnActivityMonitor } from '../ai/use-turn-activity-monitor.js';
import {
  SHELL_FOCUS_HINT_DELAY_MS,
  SHELL_ACTION_REQUIRED_TITLE_DELAY_MS,
} from '../../constants.js';
import type { StreamingState } from '../../types.js';

interface ShellInactivityStatusProps {
  activePtyId: number | string | null | undefined;
  lastOutputTime: number;
  streamingState: StreamingState;
  embeddedShellFocused: boolean;
  isInteractiveShellEnabled: boolean;
}

export type InactivityStatus = 'none' | 'action_required' | 'silent_working';

export interface ShellInactivityStatus {
  shouldShowFocusHint: boolean;
  inactivityStatus: InactivityStatus;
}

/**
 * Consolidated hook to manage all shell-related inactivity states.
 * Centralizes the timing heuristics for interactive shell activity.
 */
export const useShellInactivityStatus = ({
  activePtyId,
  lastOutputTime,
  streamingState,
  embeddedShellFocused,
  isInteractiveShellEnabled,
}: ShellInactivityStatusProps): ShellInactivityStatus => {
  const { operationStartTime } = useTurnActivityMonitor(
    streamingState,
    activePtyId,
  );

  const isAwaitingFocus =
    !!activePtyId && !embeddedShellFocused && isInteractiveShellEnabled;

  // Derive whether output was produced by comparing the last output time to when the operation started.
  const hasProducedOutput = lastOutputTime > operationStartTime;

  // 1. Focus Hint (The "press tab to focus" message in the loading indicator)
  // Logic: 5s if output has been produced, 20s if silent.
  const shouldShowFocusHint = useInactivityTimer(
    isAwaitingFocus,
    lastOutputTime,
    hasProducedOutput
      ? SHELL_FOCUS_HINT_DELAY_MS
      : SHELL_FOCUS_HINT_DELAY_MS * 4,
  );

  // 2. Action Required Status (The ✋ icon in the terminal window title)
  // Logic: Only if output has been produced (likely a prompt).
  // Triggered after 30s of silence.
  const shouldShowActionRequiredTitle = useInactivityTimer(
    isAwaitingFocus && hasProducedOutput,
    lastOutputTime,
    SHELL_ACTION_REQUIRED_TITLE_DELAY_MS,
  );

  // 3. Silent Working Status (The ⏲ icon in the terminal window title)
  // Logic: If no output has been produced yet (e.g. sleep 600), trigger after 60s.
  const shouldShowSilentWorkingTitle = useInactivityTimer(
    isAwaitingFocus && !hasProducedOutput,
    lastOutputTime,
    SHELL_ACTION_REQUIRED_TITLE_DELAY_MS * 2,
  );

  let inactivityStatus: InactivityStatus = 'none';
  if (shouldShowActionRequiredTitle) {
    inactivityStatus = 'action_required';
  } else if (shouldShowSilentWorkingTitle) {
    inactivityStatus = 'silent_working';
  }

  return {
    shouldShowFocusHint,
    inactivityStatus,
  };
};
