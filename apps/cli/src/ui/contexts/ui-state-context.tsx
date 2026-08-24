/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext } from 'react';
import type {
  HistoryItem,
  ConsoleMessageItem,
  ConfirmationRequest,
  HistoryItemWithoutId,
  StreamingState,
} from '../types.js';
import type { CommandContext, SlashCommand } from '../commands/types.js';
import type { TextBuffer } from '../hooks/input/use-text-buffer.js';
import type { PromptCompletionRuntime } from '../prompt-completion-runtime.js';
import type { DOMElement } from 'ink';
import type { SessionStatsState } from '../contexts/session-context.js';
import type { TerminalBackgroundColor } from '../../terminal/capabilities.js';
import type { TodoList } from '../tool-result.js';

export interface UIState {
  history: HistoryItem[];
  isThemeDialogOpen: boolean;
  themeError: string | null;

  editorError: string | null;
  isEditorDialogOpen: boolean;

  debugMessage: string;
  quittingMessages: HistoryItem[] | null;
  isSettingsDialogOpen: boolean;
  slashCommands: readonly SlashCommand[] | undefined;
  commandContext: CommandContext;
  confirmationRequest: ConfirmationRequest | null;
  streamingState: StreamingState;
  initError: string | null;
  todos: TodoList | null;
  shellModeActive: boolean;
  userMessages: string[];
  buffer: TextBuffer;
  inputWidth: number;
  suggestionsWidth: number;
  isInputActive: boolean;
  promptCompletionRuntime?: PromptCompletionRuntime;
  constrainHeight: boolean;
  showErrorDetails: boolean;
  filteredConsoleMessages: ConsoleMessageItem[];
  renderMarkdown: boolean;
  ctrlCPressedOnce: boolean;
  ctrlDPressedOnce: boolean;
  showEscapePrompt: boolean;
  elapsedTime: number;
  currentLoadingPhrase: string;
  historyRemountKey: number;
  messageQueue: string[];
  queueErrorMessage: string | null;
  currentModel: string;

  errorCount: number;
  availableTerminalHeight: number | undefined;
  mainAreaWidth: number;
  staticAreaMaxItemHeight: number;
  staticExtraHeight: number;
  dialogsVisible: boolean;
  pendingHistoryItems: HistoryItemWithoutId[];
  nightly: boolean;
  branchName: string | undefined;
  sessionStats: SessionStatsState;
  terminalWidth: number;
  terminalHeight: number;
  mainControlsRef: React.MutableRefObject<DOMElement | null>;
  // NOTE: This is for performance profiling only.
  rootUiRef: React.MutableRefObject<DOMElement | null>;
  activePtyId: number | undefined;
  embeddedShellFocused: boolean;
  showDebugProfiler: boolean;
  showFullTodos: boolean;
  copyModeEnabled: boolean;
  warningMessage: string | null;
  customDialog: React.ReactNode | null;
  terminalBackgroundColor: TerminalBackgroundColor;
  settingsNonce: number;
}

export const UIStateContext = createContext<UIState | null>(null);

export const useUIState = () => {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error('useUIState must be used within a UIStateProvider');
  }
  return context;
};
