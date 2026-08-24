/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { shortenPath, tildeifyPath } from '@cofy-x/dsh-console-core';
import { ConsoleSummaryDisplay } from './console-summary-display.js';
import { ThemedGradient } from '../shared/themed-gradient.js';
import { MemoryUsageDisplay } from '../stats/memory-usage-display.js';
import { DebugProfiler } from '../stats/debug-profiler.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useConfig } from '../../contexts/config-context.js';
import { useVimMode } from '../../contexts/vim-mode-context.js';
import { useSettings } from '../../contexts/settings-context.js';

const isDevelopment = process.env['NODE_ENV'] === 'development';

export const Footer: React.FC = () => {
  const uiState = useUIState();
  const config = useConfig();
  const settings = useSettings();
  const { vimEnabled, vimMode } = useVimMode();

  const {
    model,
    targetDir,
    debugMode,
    branchName,
    debugMessage,
    errorCount,
    showErrorDetails,
    nightly,
    terminalWidth,
  } = {
    model: uiState.currentModel,
    targetDir: config.getTargetDir(),
    debugMode: config.getDebugMode(),
    branchName: uiState.branchName,
    debugMessage: uiState.debugMessage,
    errorCount: uiState.errorCount,
    showErrorDetails: uiState.showErrorDetails,
    nightly: uiState.nightly,
    terminalWidth: uiState.terminalWidth,
  };

  const showMemoryUsage =
    config.getDebugMode() || settings.merged.ui.showMemoryUsage;
  const hideCWD = settings.merged.ui.footer.hideCWD;
  const hideModelInfo = settings.merged.ui.footer.hideModelInfo;

  const pathLength = Math.max(20, Math.floor(terminalWidth * 0.25));
  const displayPath = shortenPath(tildeifyPath(targetDir), pathLength);

  const justifyContent = hideCWD && hideModelInfo ? 'center' : 'space-between';
  const displayVimMode = vimEnabled ? vimMode : undefined;

  const showDebugProfiler = debugMode || isDevelopment;

  return (
    <Box
      justifyContent={justifyContent}
      width={terminalWidth}
      flexDirection="row"
      alignItems="center"
      paddingX={1}
    >
      {(showDebugProfiler || displayVimMode || !hideCWD) && (
        <Box>
          {showDebugProfiler && <DebugProfiler />}
          {displayVimMode && (
            <Text color={theme.text.secondary}>[{displayVimMode}] </Text>
          )}
          {!hideCWD &&
            (nightly ? (
              <ThemedGradient>
                {displayPath}
                {branchName && <Text> ({branchName}*)</Text>}
              </ThemedGradient>
            ) : (
              <Text color={theme.text.link}>
                {displayPath}
                {branchName && (
                  <Text color={theme.text.secondary}> ({branchName}*)</Text>
                )}
              </Text>
            ))}
          {debugMode && (
            <Text color={theme.status.error}>
              {' ' + (debugMessage || '--debug')}
            </Text>
          )}
        </Box>
      )}

      {/* Right Section: Model Label and Console Summary */}
      {!hideModelInfo && (
        <Box alignItems="center" justifyContent="flex-end">
          <Box alignItems="center">
            <Text color={theme.text.accent}>
              {model}
            </Text>
            {showMemoryUsage && <MemoryUsageDisplay />}
          </Box>
          <Box alignItems="center">
            {!showErrorDetails && errorCount > 0 && (
              <Box paddingLeft={1} flexDirection="row">
                <Text color={theme.ui.comment}>| </Text>
                <ConsoleSummaryDisplay errorCount={errorCount} />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
