/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { basename } from 'node:path';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { shortenPath, tildeifyPath } from '@cofy-x/dsh-console-core';
import { ConsoleSummaryDisplay } from './console-summary-display.js';
import { ThemedGradient } from '../shared/themed-gradient.js';
import { MemoryUsageDisplay } from '../stats/memory-usage-display.js';
import { DebugProfiler } from '../stats/debug-profiler.js';
import { ContextUsageDisplay } from '../stats/context-usage-display.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useConfig } from '../../contexts/config-context.js';
import { useVimMode } from '../../contexts/vim-mode-context.js';
import { useSettings } from '../../contexts/settings-context.js';
import { useUIActions } from '../../contexts/ui-actions-context.js';
import { InteractiveRegion } from '../shared/interactive-region.js';

const isDevelopment = process.env['NODE_ENV'] === 'development';

export const Footer: React.FC = () => {
  const uiState = useUIState();
  const config = useConfig();
  const settings = useSettings();
  const { handleFinalSubmit } = useUIActions();
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

  const isNarrow = terminalWidth < 120;
  const isCompact = terminalWidth < 160;
  const showMemoryUsage =
    !isCompact && (config.getDebugMode() || settings.merged.ui.showMemoryUsage);
  const hideCWD = settings.merged.ui.footer.hideCWD;
  const hideModelInfo = settings.merged.ui.footer.hideModelInfo;

  const pathLength = Math.max(20, Math.floor(terminalWidth * 0.25));
  const displayPath = isCompact
    ? basename(targetDir) || targetDir
    : shortenPath(tildeifyPath(targetDir), pathLength);
  const displayVimMode = vimEnabled ? vimMode : undefined;

  const sideConversation = uiState.sideConversation ?? {
    activeSurface: 'main' as const,
    mainBusy: false,
    sideBusy: false,
  };
  const showRenderDiagnostics =
    (debugMode || isDevelopment) &&
    (!isNarrow || sideConversation.activeSurface !== 'side');
  const showCwd = !hideCWD;
  const showLeft = Boolean(
    displayVimMode || showCwd || (debugMode && isNarrow),
  );
  const justifyContent = hideModelInfo
    ? showLeft
      ? 'flex-start'
      : 'center'
    : showLeft
      ? 'space-between'
      : 'flex-end';
  const displayModel = isCompact ? (model.split('/').at(-1) ?? model) : model;
  return (
    <Box
      justifyContent={justifyContent}
      width={terminalWidth}
      flexDirection="row"
      alignItems="center"
      paddingX={1}
    >
      {(displayVimMode || showCwd || (debugMode && isNarrow)) && (
        <Box flexShrink={1}>
          {displayVimMode && (
            <Text color={theme.text.secondary}>[{displayVimMode}] </Text>
          )}
          {showCwd &&
            (nightly ? (
              <ThemedGradient>
                {displayPath}
                {branchName && !isNarrow && <Text> ({branchName}*)</Text>}
              </ThemedGradient>
            ) : (
              <Text color={theme.text.link}>
                {displayPath}
                {branchName && !isNarrow && (
                  <Text color={theme.text.secondary}> ({branchName}*)</Text>
                )}
              </Text>
            ))}
          {debugMode && !isNarrow && (
            <Text color={theme.status.error}>
              {' ' + (debugMessage || '--debug')}
            </Text>
          )}
          {debugMode && isNarrow && (
            <Text color={theme.status.error}>
              {showCwd ? ' --debug' : '--debug'}
            </Text>
          )}
        </Box>
      )}

      {showRenderDiagnostics && (
        <Box
          flexGrow={1}
          flexShrink={1}
          justifyContent="center"
          marginX={terminalWidth >= 120 ? 1 : 0}
        >
          <DebugProfiler compact={isCompact} />
        </Box>
      )}

      {/* Right Section: Model Label and Console Summary */}
      {!hideModelInfo && (
        <Box alignItems="center" justifyContent="flex-end" flexShrink={1}>
          {(uiState.subagentCatalog?.runningCount ?? 0) > 0 && (
            <Box flexShrink={0}>
              <Text color={theme.status.success}>
                {isCompact
                  ? `A${uiState.subagentCatalog?.runningCount}`
                  : `${uiState.subagentCatalog?.runningCount} agent${uiState.subagentCatalog?.runningCount === 1 ? '' : 's'} working`}
              </Text>
              <Text color={theme.text.secondary}> | </Text>
            </Box>
          )}
          {sideConversation.activeSurface === 'side' && (
            <Box flexShrink={1}>
              <Text color={theme.text.accent}>Side</Text>
              <Text color={theme.text.secondary}> · Main </Text>
              <Text
                color={
                  sideConversation.mainBusy
                    ? theme.status.warning
                    : theme.status.success
                }
              >
                {sideConversation.mainBusy ? 'working' : 'idle'}
              </Text>
              <Text color={theme.text.secondary}> · </Text>
              <Text color={theme.text.accent} wrap="truncate-end">
                {isCompact ? 'Ctrl+/' : 'Ctrl+/ switch'}
              </Text>
              <Text color={theme.text.secondary}> | </Text>
            </Box>
          )}
          <Box alignItems="center" justifyContent="flex-end" flexShrink={1}>
            <InteractiveRegion
              alignItems="center"
              flexShrink={1}
              onPress={() => handleFinalSubmit('/model')}
            >
              {({ hovered }) => (
                <>
                  <Text
                    color={theme.text.accent}
                    bold={hovered}
                    underline
                    wrap="truncate-end"
                  >
                    {displayModel}
                  </Text>
                  {uiState.currentReasoningEffort && (
                    <Text
                      color={theme.text.link}
                      bold={hovered}
                    >
                      {' '}
                      {uiState.currentReasoningEffort}
                    </Text>
                  )}
                </>
              )}
            </InteractiveRegion>
            <ContextUsageDisplay
              promptTokens={uiState.sessionStats.lastPromptTokenCount}
              contextWindow={uiState.sessionStats.contextWindow}
              compact={isCompact}
            />
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
