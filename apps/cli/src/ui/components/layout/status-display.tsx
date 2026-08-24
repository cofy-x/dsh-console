/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { useUIState } from '../../contexts/ui-state-context.js';

export const StatusDisplay: React.FC = () => {
  const uiState = useUIState();

  if (process.env['DSH_CONSOLE_SYSTEM_MD']) {
    return <Text color={theme.status.error}>|⌐■_■|</Text>;
  }

  if (uiState.ctrlCPressedOnce) {
    return (
      <Text color={theme.status.warning}>Press Ctrl+C again to exit.</Text>
    );
  }

  if (uiState.warningMessage) {
    return <Text color={theme.status.warning}>{uiState.warningMessage}</Text>;
  }

  if (uiState.ctrlDPressedOnce) {
    return (
      <Text color={theme.status.warning}>Press Ctrl+D again to exit.</Text>
    );
  }

  if (uiState.showEscapePrompt) {
    if (uiState.buffer.text.length === 0) return null;

    return (
      <Text color={theme.text.secondary}>
        Press Esc again to clear prompt.
      </Text>
    );
  }

  if (uiState.queueErrorMessage) {
    return <Text color={theme.status.error}>{uiState.queueErrorMessage}</Text>;
  }

  return null;
};
