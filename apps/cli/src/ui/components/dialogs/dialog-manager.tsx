/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { ConsentPrompt } from './consent-prompt.js';
import { ThemeDialog } from './theme-dialog.js';
import { SettingsDialog } from './settings-dialog.js';
import { theme } from '../../theme/colors.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useUIActions } from '../../contexts/ui-actions-context.js';
import { useConfig } from '../../contexts/config-context.js';
import { useSettings } from '../../contexts/settings-context.js';
import process from 'node:process';
import { RESTART_EXIT_CODE, runExitCleanup } from '../../../utils/cleanup.js';
import { EditorSettingsDialog } from './editor-settings-dialog.js';

interface DialogManagerProps {
  terminalWidth: number;
}

// Props for DialogManager
export const DialogManager = ({ terminalWidth }: DialogManagerProps) => {
  const config = useConfig();
  const settings = useSettings();

  const uiState = useUIState();
  const uiActions = useUIActions();
  const {
    constrainHeight,
    terminalHeight,
    staticExtraHeight,
    terminalWidth: uiTerminalWidth,
  } = uiState;

  if (uiState.confirmationRequest) {
    return (
      <ConsentPrompt
        prompt={uiState.confirmationRequest.prompt}
        onConfirm={uiState.confirmationRequest.onConfirm}
        terminalWidth={terminalWidth}
      />
    );
  }
  if (uiState.isThemeDialogOpen) {
    return (
      <Box flexDirection="column">
        {uiState.themeError && (
          <Box marginBottom={1}>
            <Text color={theme.status.error}>{uiState.themeError}</Text>
          </Box>
        )}
        <ThemeDialog
          onSelect={uiActions.handleThemeSelect}
          onCancel={uiActions.closeThemeDialog}
          onHighlight={uiActions.handleThemeHighlight}
          settings={settings}
          availableTerminalHeight={
            constrainHeight ? terminalHeight - staticExtraHeight : undefined
          }
          terminalWidth={uiTerminalWidth}
        />
      </Box>
    );
  }
  if (uiState.isSettingsDialogOpen) {
    return (
      <Box flexDirection="column">
        <SettingsDialog
          settings={settings}
          onSelect={() => uiActions.closeSettingsDialog()}
          onRestartRequest={async () => {
            await runExitCleanup();
            process.exit(RESTART_EXIT_CODE);
          }}
          availableTerminalHeight={terminalHeight - staticExtraHeight}
          config={config}
        />
      </Box>
    );
  }
  if (uiState.isEditorDialogOpen) {
    return (
      <Box flexDirection="column">
        {uiState.editorError && (
          <Box marginBottom={1}>
            <Text color={theme.status.error}>{uiState.editorError}</Text>
          </Box>
        )}
        <EditorSettingsDialog
          onSelect={uiActions.handleEditorSelect}
          settings={settings}
          onExit={uiActions.exitEditorDialog}
        />
      </Box>
    );
  }

  return null;
};
