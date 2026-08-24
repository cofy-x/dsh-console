/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Box, useIsScreenReaderEnabled } from 'ink';
import { LoadingIndicator } from '../indicators/loading-indicator.js';
import { ShellModeIndicator } from '../indicators/shell-mode-indicator.js';
import { DetailedMessagesDisplay } from '../indicators/detailed-messages-display.js';
import { RawMarkdownIndicator } from '../indicators/raw-markdown-indicator.js';
import { InputPrompt } from './input-prompt.js';
import { Footer } from '../layout/footer.js';
import { ShowMoreLines } from '../shared/show-more-lines.js';
import { QueuedMessageDisplay } from '../indicators/queued-message-display.js';
import { OverflowProvider } from '../../contexts/overflow-context.js';
import { isNarrowWidth } from '../../theme/layout.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useUIActions } from '../../contexts/ui-actions-context.js';
import { useVimMode } from '../../contexts/vim-mode-context.js';
import { useConfig } from '../../contexts/config-context.js';
import { useSettings } from '../../contexts/settings-context.js';
import { useAlternateBuffer } from '../../hooks/terminal/use-alternate-buffer.js';
import { CommandInitDisplay } from '../help/command-init-display.js';
import { TodoTray } from '../messages/todo.js';
import { StatusDisplay } from '../layout/status-display.js';

export const Composer = ({ isFocused = true }: { isFocused?: boolean }) => {
  const config = useConfig();
  const settings = useSettings();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  const uiState = useUIState();
  const uiActions = useUIActions();
  const { vimEnabled } = useVimMode();
  const terminalWidth = process.stdout.columns;
  const isNarrow = isNarrowWidth(terminalWidth);
  const debugConsoleMaxHeight = Math.floor(Math.max(terminalWidth * 0.2, 5));
  const [, setSuggestionsVisible] = useState(false);

  const isAlternateBuffer = useAlternateBuffer();
  const suggestionsPosition = isAlternateBuffer ? 'above' : 'below';
  return (
    <Box
      flexDirection="column"
      width={uiState.terminalWidth}
      flexGrow={0}
      flexShrink={0}
    >
      {!uiState.embeddedShellFocused && (
        <LoadingIndicator
          currentLoadingPhrase={
            config.getAccessibility()?.enableLoadingPhrases === false
              ? undefined
              : uiState.currentLoadingPhrase
          }
          elapsedTime={uiState.elapsedTime}
        />
      )}

      {!uiState.slashCommands && <CommandInitDisplay />}

      <QueuedMessageDisplay messageQueue={uiState.messageQueue} />

      <TodoTray />

      <Box
        marginTop={1}
        justifyContent="space-between"
        width="100%"
        flexDirection={isNarrow ? 'column' : 'row'}
        alignItems={isNarrow ? 'flex-start' : 'center'}
      >
        <Box marginRight={1}>
          <StatusDisplay />
        </Box>
        <Box paddingTop={isNarrow ? 1 : 0}>
          {uiState.shellModeActive && <ShellModeIndicator />}
          {!uiState.renderMarkdown && <RawMarkdownIndicator />}
        </Box>
      </Box>

      {uiState.showErrorDetails && (
        <OverflowProvider>
          <Box flexDirection="column">
            <DetailedMessagesDisplay
              messages={uiState.filteredConsoleMessages}
              maxHeight={
                uiState.constrainHeight ? debugConsoleMaxHeight : undefined
              }
              width={uiState.terminalWidth}
              hasFocus={uiState.showErrorDetails}
            />
            <ShowMoreLines constrainHeight={uiState.constrainHeight} />
          </Box>
        </OverflowProvider>
      )}

      {uiState.isInputActive && (
        <InputPrompt
          buffer={uiState.buffer}
          inputWidth={uiState.inputWidth}
          suggestionsWidth={uiState.suggestionsWidth}
          onSubmit={uiActions.handleFinalSubmit}
          userMessages={uiState.userMessages}
          promptCompletionRuntime={uiState.promptCompletionRuntime}
          onClearScreen={uiActions.handleClearScreen}
          config={config}
          slashCommands={uiState.slashCommands || []}
          commandContext={uiState.commandContext}
          shellModeActive={uiState.shellModeActive}
          setShellModeActive={uiActions.setShellModeActive}
          onEscapePromptChange={uiActions.onEscapePromptChange}
          focus={isFocused}
          vimHandleInput={uiActions.vimHandleInput}
          isEmbeddedShellFocused={uiState.embeddedShellFocused}
          popAllMessages={uiActions.popAllMessages}
          placeholder={
            vimEnabled
              ? "  Press 'i' for INSERT mode and 'Esc' for NORMAL mode."
              : uiState.shellModeActive
                ? '  Type your shell command'
                : '  Type your message or @path/to/file'
          }
          setQueueErrorMessage={uiActions.setQueueErrorMessage}
          streamingState={uiState.streamingState}
          suggestionsPosition={suggestionsPosition}
          onSuggestionsVisibilityChange={setSuggestionsVisible}
        />
      )}

      {!settings.merged.ui.hideFooter && !isScreenReaderEnabled && <Footer />}
    </Box>
  );
};
