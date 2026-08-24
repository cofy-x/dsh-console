/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text, useIsScreenReaderEnabled } from 'ink';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../contexts/app-context.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { theme } from '../../theme/colors.js';
import { StreamingState } from '../../types.js';
import { DSH_CONSOLE_DIR, homedir } from '@cofy-x/dsh-console-core';

import path from 'node:path';
import { persistentState } from '../../state/persistent.js';

const settingsPath = path.join(homedir(), DSH_CONSOLE_DIR, 'settings.json');

export const Notifications = () => {
  const { startupWarnings } = useAppContext();
  const { initError, streamingState } = useUIState();

  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  const showStartupWarnings = startupWarnings.length > 0;
  const showInitError =
    initError && streamingState !== StreamingState.Responding;

  const [hasSeenScreenReaderNudge] = useState(
    () => persistentState.get('hasSeenScreenReaderNudge') ?? false,
  );

  const showScreenReaderNudge =
    isScreenReaderEnabled && hasSeenScreenReaderNudge === false;

  useEffect(() => {
    if (showScreenReaderNudge) {
      persistentState.set('hasSeenScreenReaderNudge', true);
    }
  }, [showScreenReaderNudge]);

  if (
    !showStartupWarnings &&
    !showInitError &&
    !showScreenReaderNudge
  ) {
    return null;
  }

  return (
    <>
      {showScreenReaderNudge && (
        <Text>
          You are currently in screen reader-friendly view. To switch out, open{' '}
          {settingsPath} and remove the entry for {'"screenReader"'}. This will
          disappear on next run.
        </Text>
      )}
      {showStartupWarnings && (
        <Box
          borderStyle="round"
          borderColor={theme.status.warning}
          paddingX={1}
          marginY={1}
          flexDirection="column"
        >
          {startupWarnings.map((warning, index) => (
            <Text key={index} color={theme.status.warning}>
              {warning}
            </Text>
          ))}
        </Box>
      )}
      {showInitError && (
        <Box
          borderStyle="round"
          borderColor={theme.status.error}
          paddingX={1}
          marginBottom={1}
        >
          <Text color={theme.status.error}>
            Initialization Error: {initError}
          </Text>
          <Text color={theme.status.error}>
            {' '}
            Please check API key and configuration.
          </Text>
        </Box>
      )}
    </>
  );
};
