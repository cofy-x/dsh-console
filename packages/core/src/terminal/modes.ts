/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeToStdout } from './stdio.js';

export type MouseTrackingMode = 'button-motion' | 'any-motion';

let preferredMouseTrackingMode: MouseTrackingMode = 'button-motion';

/**
 * Enables mouse tracking using the requested motion policy.
 *
 * The selected policy is retained so temporary terminal suspensions can be
 * resumed without weakening an active UI owner's tracking requirements.
 */
export function enableMouseEvents(mode: MouseTrackingMode = 'button-motion') {
  preferredMouseTrackingMode = mode;
  writeMouseTrackingMode(mode);
}

/** Restores the policy selected by the last explicit enable call. */
export function resumeMouseEvents() {
  writeMouseTrackingMode(preferredMouseTrackingMode);
}

function writeMouseTrackingMode(mode: MouseTrackingMode) {
  const trackingSequence =
    mode === 'any-motion'
      ? '\u001b[?1002l\u001b[?1003h'
      : '\u001b[?1003l\u001b[?1002h';

  // Keep the tracking policies mutually exclusive and use SGR coordinates.
  writeToStdout(`${trackingSequence}\u001b[?1006h`);
}

export function disableMouseEvents() {
  // Disable mouse tracking with SGR format
  // Clear all tracking modes so interrupted runs cannot leak state.
  writeToStdout('\u001b[?1006l\u001b[?1003l\u001b[?1002l');
}

export function enableKittyKeyboardProtocol() {
  writeToStdout('\x1b[>1u');
}

export function disableKittyKeyboardProtocol() {
  writeToStdout('\x1b[<u');
}

export function enableModifyOtherKeys() {
  writeToStdout('\x1b[>4;2m');
}

export function disableModifyOtherKeys() {
  writeToStdout('\x1b[>4;0m');
}

export function enableBracketedPasteMode() {
  writeToStdout('\x1b[?2004h');
}

export function disableBracketedPasteMode() {
  writeToStdout('\x1b[?2004l');
}

export function disableLineWrapping() {
  writeToStdout('\x1b[?7l');
}

export function enterAlternateScreen() {
  writeToStdout('\x1b[?1049h');
}

export function shouldEnterAlternateScreen(
  useAlternateBuffer: boolean,
  isScreenReader: boolean,
): boolean {
  return useAlternateBuffer && !isScreenReader;
}
