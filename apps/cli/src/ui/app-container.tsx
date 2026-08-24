/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import { type DOMElement, measureElement, useApp } from 'ink';
import { App } from './app.js';
import { AppContext } from './contexts/app-context.js';
import { UIStateContext, type UIState } from './contexts/ui-state-context.js';
import {
  UIActionsContext,
  type UIActions,
} from './contexts/ui-actions-context.js';
import { ConfigContext } from './contexts/config-context.js';
import {
  type HistoryItem,
  ToolCallStatus,
  type HistoryItemWithoutId,
  MessageType,
  StreamingState,
} from './types.js';
import {
  type EditorType,
  getErrorMessage,
  ShellExecutionService,
  debugLogger,
  type UserFeedbackPayload,
  coreEvents,
  CoreEvent,
  disableMouseEvents,
  enableMouseEvents,
  startupProfiler,
  shouldEnterAlternateScreen,
  enterAlternateScreen,
  disableLineWrapping,
} from '@cofy-x/dsh-console-core';
import process from 'node:process';
import { useHistory } from './hooks/session/use-history-manager.js';
import { useSlashCommandProcessor } from './hooks/commands/use-slash-command-processor.js';
import { useVimMode } from './contexts/vim-mode-context.js';
import { useTerminalSize } from './hooks/terminal/use-terminal-size.js';
import { useStdout, useStdin } from 'ink';
import ansiEscapes from 'ansi-escapes';
import * as fs from 'node:fs';
import { basename, join } from 'node:path';
import type { InitializationResult } from './initialization-result.js';
import { useFocus } from './hooks/terminal/use-focus.js';
import { useKeypress } from './hooks/input/use-keypress.js';
import { appEvents, AppEvent } from '../utils/events.js';
import {
  registerCleanup,
  RESTART_EXIT_CODE,
  runExitCleanup,
} from '../utils/cleanup.js';
import { useSessionStats } from './contexts/session-context.js';
import { ShellFocusContext } from './contexts/shell-focus-context.js';
import { useSettings } from './contexts/settings-context.js';
import { useAlternateBuffer } from './hooks/terminal/use-alternate-buffer.js';
import type { Config } from '../config/config.js';
import { Command } from '../config/key-bindings.js';
import { computeTerminalTitle } from '../terminal/window-title.js';
import { calculatePromptWidths } from './components/input/input-prompt.js';
import { useSettingsCommand } from './hooks/commands/use-settings-command.js';
import { useThemeCommand } from './hooks/commands/use-theme-command.js';
import { useTextBuffer } from './hooks/input/use-text-buffer.js';
import { useVim } from './hooks/input/use-vim.js';
import { useGitBranchName } from './hooks/session/use-git-branch-name.js';
import { useEditorSettings } from './hooks/settings/use-editor-settings.js';
import { useMemoryMonitor } from './hooks/terminal/use-memory-monitor.js';
import { useConsoleMessages } from './hooks/visual/use-console-messages.js';
import { useLoadingIndicator } from './hooks/visual/use-loading-indicator.js';
import { keyMatchers } from './input/key-matchers.js';
import { calculateMainAreaWidth } from './theme/layout.js';
import type { Key } from '../terminal/keys.js';
import { useMessageQueue } from './hooks/session/use-message-queue.js';
import { useInputHistoryStore } from './hooks/input/use-input-history-store.js';
import { PromptHistoryStore } from '../services/prompt-history-store.js';
import { terminalCapabilityManager } from '../terminal/capabilities.js';
import {
  QUEUE_ERROR_DISPLAY_DURATION_MS,
  WARNING_PROMPT_DURATION_MS,
} from './constants.js';
import { useShellInactivityStatus } from './hooks/terminal/use-shell-inactivity-status.js';
import { ApprovalRuntimeProvider } from './contexts/approval-context.js';
import { UserQuestionRuntimeProvider } from './contexts/user-question-context.js';
import { isSlashCommand } from './commands/utils.js';
import {
  conversationMessageText,
  type ConversationRuntime,
} from './conversation-runtime.js';
import type { PromptCompletionRuntime } from './prompt-completion-runtime.js';
import type { PromptInputRuntime } from './prompt-input-runtime.js';
import { getProjectClipboardImagesDir } from '../terminal/clipboard/reader.js';
import type { ModelSelectionRuntime } from './model-selection-runtime.js';
import { modelSelectionLabel } from './model-selection-runtime.js';
import type { SessionManagementRuntime } from './session-management-runtime.js';
import type { ApprovalRuntime } from './approval-runtime.js';
import type { UserQuestionRuntime } from './user-question-runtime.js';
import type { DshCommandRuntime } from './command-runtime.js';
import type { ToolCatalogRuntime } from './tool-catalog-runtime.js';
import { useLocalShellCommand } from './hooks/input/use-local-shell-command.js';

interface AppContainerProps {
  config: Config;
  startupWarnings?: string[];
  version: string;
  initializationResult: InitializationResult;
  conversationRuntime: ConversationRuntime;
  promptCompletionRuntime?: PromptCompletionRuntime;
  promptInputRuntime?: PromptInputRuntime;
  modelSelectionRuntime?: ModelSelectionRuntime;
  sessionManagementRuntime?: SessionManagementRuntime;
  approvalRuntime: ApprovalRuntime;
  userQuestionRuntime: UserQuestionRuntime;
  commandRuntime: DshCommandRuntime;
  toolCatalogRuntime: ToolCatalogRuntime;
  initialPrompt?: string;
}

/**
 * The fraction of the terminal width to allocate to the shell.
 * This provides horizontal padding.
 */
const SHELL_WIDTH_FRACTION = 0.89;

/**
 * The number of lines to subtract from the available terminal height
 * for the shell. This provides vertical padding and space for other UI elements.
 */
const SHELL_HEIGHT_PADDING = 10;

export const AppContainer = (props: AppContainerProps) => {
  const {
    config,
    initializationResult,
    conversationRuntime,
    promptCompletionRuntime,
    promptInputRuntime,
    modelSelectionRuntime,
    sessionManagementRuntime,
    approvalRuntime,
    userQuestionRuntime,
    commandRuntime,
    toolCatalogRuntime,
  } = props;
  const historyManager = useHistory();
  const conversationSnapshot = useSyncExternalStore(
    conversationRuntime.subscribe,
    conversationRuntime.getSnapshot,
    conversationRuntime.getSnapshot,
  );
  const approvalSnapshot = useSyncExternalStore(
    approvalRuntime.subscribe,
    approvalRuntime.getSnapshot,
    approvalRuntime.getSnapshot,
  );
  const pendingApproval = approvalSnapshot.pending[0];
  const userQuestionSnapshot = useSyncExternalStore(
    userQuestionRuntime.subscribe,
    userQuestionRuntime.getSnapshot,
    userQuestionRuntime.getSnapshot,
  );
  const pendingUserQuestion = userQuestionSnapshot.pending[0];
  const conversationHistoryIds = useRef(new Map<string, number>());
  const conversationHistoryTexts = useRef(new Map<string, string>());
  const conversationSessionId = conversationRuntime.getSessionStats().sessionId;
  const [projectedSessionId, setProjectedSessionId] = useState(
    conversationSessionId,
  );
  const promptInputAbortRef = useRef<AbortController | undefined>(undefined);
  const [promptInputPreparing, setPromptInputPreparing] = useState(false);
  const addConversationHistoryItem = historyManager.addItem;
  const updateConversationHistoryItem = historyManager.updateItem;
  const clearConversationHistory = historyManager.clearItems;
  useEffect(() => {
    if (projectedSessionId !== conversationSessionId) {
      conversationHistoryIds.current.clear();
      conversationHistoryTexts.current.clear();
      clearConversationHistory();
      setProjectedSessionId(conversationSessionId);
      return;
    }
    const visibleHistoryIds = new Set(
      historyManager.history.map((item) => item.id),
    );
    const projectedToolCallIds = new Set(
      conversationSnapshot.messages.flatMap((message) =>
        message.role === 'tool' ? [message.callId] : [],
      ),
    );
    for (const message of conversationSnapshot.messages) {
      const historyId = conversationHistoryIds.current.get(message.id);
      const assistantContent =
        message.role === 'assistant'
          ? message.content.filter(
              (block) =>
                block.type !== 'tool-call' ||
                !projectedToolCallIds.has(block.id),
            )
          : undefined;
      if (
        message.role === 'assistant' &&
        assistantContent?.length === 0 &&
        message.interrupted !== true
      ) {
        continue;
      }
      const messageText =
        message.role === 'tool' ? undefined : conversationMessageText(message);
      const item: HistoryItemWithoutId =
        message.role === 'tool'
          ? {
              type: 'tool_group',
              tools: [
                {
                  callId: message.callId,
                  name:
                    message.presentation?.kind === 'card'
                      ? (message.presentation.title ?? message.name)
                      : message.name,
                  description:
                    message.presentation?.kind === 'compact'
                      ? ''
                      : (message.presentation?.description ??
                        message.arguments),
                  resultDisplay:
                    message.presentation?.kind === 'compact'
                      ? undefined
                      : (message.presentation?.resultDisplay ??
                        (message.result === undefined
                          ? undefined
                          : {
                              type: 'dsh-content',
                              content: message.result.content,
                              ...(message.result.error === undefined
                                ? {}
                                : { error: message.result.error }),
                            })),
                  ...(message.presentation?.kind === 'compact'
                    ? {
                        presentation: {
                          kind: 'compact' as const,
                          label: message.presentation.label,
                        },
                      }
                    : {}),
                  status:
                    message.status === 'executing'
                      ? ToolCallStatus.Executing
                      : message.status === 'success'
                        ? ToolCallStatus.Success
                        : ToolCallStatus.Error,
                },
              ],
            }
          : message.role === 'assistant'
            ? {
                type: 'dsh_assistant',
                content: assistantContent ?? message.content,
                interrupted: message.interrupted === true,
              }
            : message.role === 'user'
              ? {
                  type: 'dsh_user',
                  content: message.displayContent ?? message.content,
                }
              : {
                  type:
                    message.status === 'cancelled'
                      ? MessageType.WARNING
                      : MessageType.ERROR,
                  text: messageText ?? '',
                };
      const fingerprint =
        message.role === 'tool'
          ? JSON.stringify([
              message.status,
              message.result,
              message.presentation,
            ])
          : message.role === 'assistant'
            ? JSON.stringify([assistantContent, message.interrupted])
            : message.role === 'user'
              ? JSON.stringify(message.displayContent ?? message.content)
              : (messageText ?? '');
      if (historyId === undefined || !visibleHistoryIds.has(historyId)) {
        const nextHistoryId = addConversationHistoryItem(item);
        conversationHistoryIds.current.set(message.id, nextHistoryId);
        conversationHistoryTexts.current.set(message.id, fingerprint);
        visibleHistoryIds.add(nextHistoryId);
      } else if (
        conversationHistoryTexts.current.get(message.id) !== fingerprint
      ) {
        updateConversationHistoryItem(historyId, item);
        conversationHistoryTexts.current.set(message.id, fingerprint);
      }
    }
  }, [
    conversationSessionId,
    projectedSessionId,
    conversationRuntime,
    conversationSnapshot.messages,
    historyManager.history,
    addConversationHistoryItem,
    updateConversationHistoryItem,
    clearConversationHistory,
  ]);
  useMemoryMonitor(historyManager);
  const settings = useSettings();
  const isAlternateBuffer = useAlternateBuffer();
  const [debugMessage, setDebugMessage] = useState<string>('');
  const [quittingMessages, setQuittingMessages] = useState<
    HistoryItem[] | null
  >(null);
  const [themeError, setThemeError] = useState<string | null>(
    initializationResult.themeError,
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [embeddedShellFocused, setEmbeddedShellFocused] = useState(false);
  const [showDebugProfiler, setShowDebugProfiler] = useState(false);
  const [customDialog, setCustomDialog] = useState<React.ReactNode | null>(
    null,
  );
  const [copyModeEnabled, setCopyModeEnabled] = useState(false);
  const [pendingRestorePrompt, setPendingRestorePrompt] = useState(false);
  const [shellModeActive, setShellModeActive] = useState(false);
  const [pendingShellHistoryItem, setPendingShellHistoryItem] =
    useState<HistoryItemWithoutId | null>(null);
  const [historyRemountKey, setHistoryRemountKey] = useState(0);
  const [settingsNonce, setSettingsNonce] = useState(0);
  const [queueErrorMessage, setQueueErrorMessage] = useState<string | null>(
    null,
  );

  const toggleDebugProfiler = useCallback(
    () => setShowDebugProfiler((prev) => !prev),
    [],
  );

  const [modelSelectionSnapshot, setModelSelectionSnapshot] = useState(() =>
    modelSelectionRuntime?.getSnapshot(),
  );
  useEffect(
    () =>
      modelSelectionRuntime?.subscribe(() =>
        setModelSelectionSnapshot(modelSelectionRuntime.getSnapshot()),
      ),
    [modelSelectionRuntime],
  );
  const currentModel = modelSelectionSnapshot
    ? modelSelectionLabel(modelSelectionSnapshot.current)
    : 'DSH default';

  const promptHistory = useMemo(
    () =>
      new PromptHistoryStore(
        join(config.storage.getProjectTempDir(), 'prompt_history.json'),
      ),
    [config.storage],
  );
  const { inputHistory, addInput, initializeFromHistory } =
    useInputHistoryStore();

  // Terminal and layout hooks
  const { columns: terminalWidth, rows: terminalHeight } = useTerminalSize();
  const { stdin, setRawMode } = useStdin();
  const { stdout } = useStdout();
  const app = useApp();

  // Additional hooks moved from App.tsx
  const { stats: sessionStats } = useSessionStats();
  const branchName = useGitBranchName(config.getTargetDir());

  // Layout measurements
  const mainControlsRef = useRef<DOMElement>(null);
  // For performance profiling only
  const rootUiRef = useRef<DOMElement>(null);
  const lastTitleRef = useRef<string | null>(null);
  const staticExtraHeight = 3;

  useEffect(() => {
    void (async () => {
      startupProfiler.flush();
    })();
    registerCleanup(async () => {
      // Turn off mouse scroll.
      disableMouseEvents();
    });
  }, [config]);

  useEffect(() => {
    const handleSettingsChanged = () => {
      setSettingsNonce((prev) => prev + 1);
    };

    coreEvents.on(CoreEvent.SettingsChanged, handleSettingsChanged);
    return () => {
      coreEvents.off(CoreEvent.SettingsChanged, handleSettingsChanged);
    };
  }, []);

  const { consoleMessages, clearConsoleMessages: clearConsoleMessagesState } =
    useConsoleMessages();

  const mainAreaWidth = calculateMainAreaWidth(terminalWidth, settings);
  // Derive widths for InputPrompt using shared helper
  const { inputWidth, suggestionsWidth } = useMemo(() => {
    const { inputWidth, suggestionsWidth } =
      calculatePromptWidths(mainAreaWidth);
    return { inputWidth, suggestionsWidth };
  }, [mainAreaWidth]);

  const staticAreaMaxItemHeight = Math.max(terminalHeight * 4, 100);

  const isValidPath = useCallback((filePath: string): boolean => {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (_e) {
      return false;
    }
  }, []);

  const getPreferredEditor = useCallback(
    () => settings.merged.general.preferredEditor as EditorType,
    [settings.merged.general.preferredEditor],
  );

  const buffer = useTextBuffer({
    initialText: '',
    viewport: { height: 10, width: inputWidth },
    stdin,
    setRawMode,
    isValidPath,
    shellModeActive,
    getPreferredEditor,
  });

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initializeFromHistory(promptHistory);
  }, [initializeFromHistory, promptHistory]);

  const refreshStatic = useCallback(() => {
    if (!isAlternateBuffer) {
      stdout.write(ansiEscapes.clearTerminal);
    }
    setHistoryRemountKey((prev) => prev + 1);
  }, [setHistoryRemountKey, isAlternateBuffer, stdout]);

  const handleEditorClose = useCallback(() => {
    if (
      shouldEnterAlternateScreen(isAlternateBuffer, config.getScreenReader())
    ) {
      // The editor may have exited alternate buffer mode so we need to
      // enter it again to be safe.
      enterAlternateScreen();
      enableMouseEvents();
      disableLineWrapping();
      app.rerender();
    }
    terminalCapabilityManager.enableSupportedModes();
    refreshStatic();
  }, [refreshStatic, isAlternateBuffer, app, config]);

  useEffect(() => {
    coreEvents.on(CoreEvent.ExternalEditorClosed, handleEditorClose);
    return () => {
      coreEvents.off(CoreEvent.ExternalEditorClosed, handleEditorClose);
    };
  }, [handleEditorClose]);

  const {
    isThemeDialogOpen,
    openThemeDialog,
    closeThemeDialog,
    handleThemeSelect,
    handleThemeHighlight,
  } = useThemeCommand(
    settings,
    setThemeError,
    historyManager.addItem,
    initializationResult.themeError,
  );

  const [editorError, setEditorError] = useState<string | null>(null);
  const {
    isEditorDialogOpen,
    openEditorDialog,
    handleEditorSelect,
    exitEditorDialog,
  } = useEditorSettings(settings, setEditorError, historyManager.addItem);

  const { isSettingsDialogOpen, openSettingsDialog, closeSettingsDialog } =
    useSettingsCommand();

  const { toggleVimEnabled } = useVimMode();

  const slashCommandActions = useMemo(
    () => ({
      openThemeDialog,
      openEditorDialog,
      openSettingsDialog,
      quit: (messages: HistoryItem[]) => {
        setQuittingMessages(messages);
        setTimeout(async () => {
          await runExitCleanup();
          process.exit(0);
        }, 100);
      },
      toggleDebugProfiler,
      setText: (text: string) => buffer.setText(text),
    }),
    [
      openThemeDialog,
      openEditorDialog,
      openSettingsDialog,
      setQuittingMessages,
      toggleDebugProfiler,
      buffer,
    ],
  );

  const {
    handleSlashCommand,
    slashCommands,
    commandContext,
    confirmationRequest,
    cancelCommand,
  } = useSlashCommandProcessor(
    historyManager.addItem,
    historyManager.clearItems,
    historyManager.loadHistory,
    refreshStatic,
    toggleVimEnabled,
    setIsProcessing,
    slashCommandActions,
    setCustomDialog,
    modelSelectionRuntime,
    sessionManagementRuntime,
    toolCatalogRuntime,
    commandRuntime,
  );

  const cancelHandlerRef = useRef<(shouldRestorePrompt?: boolean) => void>(
    () => {},
  );

  useEffect(() => {
    if (pendingRestorePrompt) {
      const lastHistoryUserMsg = historyManager.history.findLast(
        (h) => h.type === 'user',
      );
      const lastUserMsg = inputHistory.at(-1);

      if (
        !lastHistoryUserMsg ||
        (typeof lastHistoryUserMsg.text === 'string' &&
          lastHistoryUserMsg.text === lastUserMsg)
      ) {
        cancelHandlerRef.current(true);
        setPendingRestorePrompt(false);
      }
    }
  }, [pendingRestorePrompt, inputHistory, historyManager.history]);

  const initError = initializationResult.initError;
  const todos = useMemo<UIState['todos']>(
    () => ({
      todos: conversationSnapshot.todos.map((todo) => ({
        description: todo.content,
        status: todo.status,
      })),
    }),
    [conversationSnapshot.todos],
  );
  const {
    execute: executeLocalShell,
    cancel: cancelLocalShell,
    isExecuting: localShellExecuting,
    activePtyId,
    lastOutputTime,
  } = useLocalShellCommand({
    addItem: historyManager.addItem,
    setPendingItem: setPendingShellHistoryItem,
    onDebugMessage: setDebugMessage,
    config,
    setShellInputFocused: setEmbeddedShellFocused,
    terminalWidth,
    terminalHeight,
  });
  const streamingState =
    conversationSnapshot.busy ||
    promptInputPreparing ||
    localShellExecuting ||
    isProcessing
      ? StreamingState.Responding
      : StreamingState.Idle;
  const submitQuery = useCallback(
    (query: string) => {
      if (isSlashCommand(query.trim())) {
        void handleSlashCommand(query);
        return;
      }
      promptInputAbortRef.current?.abort();
      const controller = new AbortController();
      promptInputAbortRef.current = controller;
      setPromptInputPreparing(true);
      const prepared = promptInputRuntime
        ? promptInputRuntime.prepare({
            text: query,
            workspaceRoots: [config.getTargetDir()],
            clipboardImageRoots: [
              getProjectClipboardImagesDir(config.getTargetDir()),
            ],
            signal: controller.signal,
          })
        : Promise.resolve({
            content: [{ type: 'text' as const, text: query }],
            displayContent: [{ type: 'text' as const, text: query }],
          });
      void prepared
        .then((input) =>
          conversationRuntime.submit({
            ...input,
            signal: controller.signal,
          }),
        )
        .catch((error: unknown) => {
          buffer.setText(query);
          if (!(error instanceof Error && error.name === 'AbortError')) {
            debugLogger.debug(
              `Prompt input preparation failed: ${String(error)}`,
            );
            addConversationHistoryItem({
              type: MessageType.ERROR,
              text: `Unable to prepare input: ${getErrorMessage(error)}`,
            });
          }
        })
        .finally(() => {
          if (promptInputAbortRef.current === controller) {
            promptInputAbortRef.current = undefined;
            setPromptInputPreparing(false);
          }
        });
    },
    [
      addConversationHistoryItem,
      conversationRuntime,
      config,
      promptInputRuntime,
      handleSlashCommand,
      buffer,
    ],
  );
  const cancelOngoingRequest = useCallback(() => {
    cancelCommand();
    cancelLocalShell();
    promptInputAbortRef.current?.abort();
    conversationRuntime.cancel();
  }, [cancelCommand, cancelLocalShell, conversationRuntime]);

  useEffect(
    () => () => {
      promptInputAbortRef.current?.abort();
    },
    [],
  );

  const lastOutputTimeRef = useRef(0);
  useEffect(() => {
    lastOutputTimeRef.current = lastOutputTime;
  }, [lastOutputTime]);

  const { shouldShowFocusHint, inactivityStatus } = useShellInactivityStatus({
    activePtyId,
    lastOutputTime,
    streamingState,
    embeddedShellFocused,
    isInteractiveShellEnabled: config.isInteractiveShellEnabled(),
  });

  const shouldShowActionRequiredTitle = inactivityStatus === 'action_required';
  const shouldShowSilentWorkingTitle = inactivityStatus === 'silent_working';

  const {
    messageQueue,
    addMessage,
    clearQueue,
    getQueuedMessagesText,
    popAllMessages,
  } = useMessageQueue({
    streamingState,
    submitQuery,
  });

  cancelHandlerRef.current = useCallback(
    (shouldRestorePrompt: boolean = true) => {
      const lastUserMessage = inputHistory.at(-1);
      let textToSet = shouldRestorePrompt ? lastUserMessage || '' : '';

      const queuedText = getQueuedMessagesText();
      if (queuedText) {
        textToSet = textToSet ? `${textToSet}\n\n${queuedText}` : queuedText;
        clearQueue();
      }

      if (textToSet || !shouldRestorePrompt) {
        buffer.setText(textToSet);
      }
    },
    [
      buffer,
      inputHistory,
      getQueuedMessagesText,
      clearQueue,
    ],
  );

  const handleFinalSubmit = useCallback(
    (submittedValue: string) => {
      if (shellModeActive) {
        executeLocalShell(submittedValue);
        return;
      }
      const isSlash = isSlashCommand(submittedValue.trim());
      const isIdle = streamingState === StreamingState.Idle;

      if (isSlash || isIdle) {
        void submitQuery(submittedValue);
      } else {
        addMessage(submittedValue);
      }
      addInput(submittedValue); // Track input for up-arrow history
      void promptHistory.append(submittedValue).catch((error) => {
        debugLogger.debug('Failed to persist prompt history:', error);
      });
    },
    [
      addMessage,
      addInput,
      executeLocalShell,
      promptHistory,
      shellModeActive,
      submitQuery,
      streamingState,
    ],
  );

  const handleClearScreen = useCallback(() => {
    historyManager.clearItems();
    clearConsoleMessagesState();
    refreshStatic();
  }, [historyManager, clearConsoleMessagesState, refreshStatic]);

  const { handleInput: vimHandleInput } = useVim(buffer, handleFinalSubmit);

  /**
   * Determines if the input prompt should be active and accept user input.
   * Input is disabled during:
   * - Initialization errors
   * - Slash command processing
   * - DSH approval requests
   * - Any future streaming states not explicitly allowed
   */
  const isInputActive =
    !initError &&
    !isProcessing &&
    pendingApproval === undefined &&
    pendingUserQuestion === undefined &&
    !!slashCommands &&
    (streamingState === StreamingState.Idle ||
      streamingState === StreamingState.Responding);

  const [controlsHeight, setControlsHeight] = useState(0);

  useLayoutEffect(() => {
    if (mainControlsRef.current) {
      const fullFooterMeasurement = measureElement(mainControlsRef.current);
      if (
        fullFooterMeasurement.height > 0 &&
        fullFooterMeasurement.height !== controlsHeight
      ) {
        setControlsHeight(fullFooterMeasurement.height);
      }
    }
  }, [buffer, terminalWidth, terminalHeight, controlsHeight]);

  // Compute available terminal height based on controls measurement
  const availableTerminalHeight = Math.max(
    0,
    terminalHeight - controlsHeight - staticExtraHeight - 2,
  );

  config.setShellExecutionConfig({
    terminalWidth: Math.floor(terminalWidth * SHELL_WIDTH_FRACTION),
    terminalHeight: Math.max(
      Math.floor(availableTerminalHeight - SHELL_HEIGHT_PADDING),
      1,
    ),
    pager: settings.merged.tools.shell.pager,
    showColor: settings.merged.tools.shell.showColor,
    sanitizationConfig: config.sanitizationConfig,
  });

  const isFocused = useFocus();

  // Initial prompt handling
  const initialPrompt = useMemo(
    () => props.initialPrompt ?? config.getQuestion(),
    [config, props.initialPrompt],
  );
  const initialPromptSubmitted = useRef(false);
  useEffect(() => {
    if (activePtyId) {
      try {
        ShellExecutionService.resizePty(
          activePtyId,
          Math.floor(terminalWidth * SHELL_WIDTH_FRACTION),
          Math.max(
            Math.floor(availableTerminalHeight - SHELL_HEIGHT_PADDING),
            1,
          ),
        );
      } catch (e) {
        // This can happen in a race condition where the pty exits
        // right before we try to resize it.
        if (
          !(
            e instanceof Error &&
            e.message.includes('Cannot resize a pty that has already exited')
          )
        ) {
          throw e;
        }
      }
    }
  }, [terminalWidth, availableTerminalHeight, activePtyId]);

  useEffect(() => {
    if (
      initialPrompt &&
      !initialPromptSubmitted.current &&
      !isThemeDialogOpen &&
      !isEditorDialogOpen &&
      conversationRuntime
    ) {
      handleFinalSubmit(initialPrompt);
      initialPromptSubmitted.current = true;
    }
  }, [
    initialPrompt,
    handleFinalSubmit,
    isThemeDialogOpen,
    isEditorDialogOpen,
    conversationRuntime,
  ]);

  const [showErrorDetails, setShowErrorDetails] = useState<boolean>(false);
  const [showFullTodos, setShowFullTodos] = useState<boolean>(false);
  const [renderMarkdown, setRenderMarkdown] = useState<boolean>(true);

  const [ctrlCPressCount, setCtrlCPressCount] = useState(0);
  const ctrlCTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [ctrlDPressCount, setCtrlDPressCount] = useState(0);
  const ctrlDTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [constrainHeight, setConstrainHeight] = useState<boolean>(true);
  const [showEscapePrompt, setShowEscapePrompt] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const isInitialMount = useRef(true);

  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tabFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleWarning = useCallback((message: string) => {
    setWarningMessage(message);
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    warningTimeoutRef.current = setTimeout(() => {
      setWarningMessage(null);
    }, WARNING_PROMPT_DURATION_MS);
  }, []);

  useEffect(() => {
    const handleSelectionWarning = () => {
      handleWarning('Press Ctrl-S to enter selection mode to copy text.');
    };
    const handlePasteTimeout = () => {
      handleWarning('Paste Timed out. Possibly due to slow connection.');
    };
    appEvents.on(AppEvent.SelectionWarning, handleSelectionWarning);
    appEvents.on(AppEvent.PasteTimeout, handlePasteTimeout);
    return () => {
      appEvents.off(AppEvent.SelectionWarning, handleSelectionWarning);
      appEvents.off(AppEvent.PasteTimeout, handlePasteTimeout);
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (tabFocusTimeoutRef.current) {
        clearTimeout(tabFocusTimeoutRef.current);
      }
    };
  }, [handleWarning]);

  useEffect(() => {
    if (queueErrorMessage) {
      const timer = setTimeout(() => {
        setQueueErrorMessage(null);
      }, QUEUE_ERROR_DISPLAY_DURATION_MS);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [queueErrorMessage, setQueueErrorMessage]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const handler = setTimeout(() => {
      refreshStatic();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [terminalWidth, refreshStatic]);

  useEffect(() => {
    const openDebugConsole = () => {
      setShowErrorDetails(true);
      setConstrainHeight(false);
    };
    appEvents.on(AppEvent.OpenDebugConsole, openDebugConsole);

    return () => {
      appEvents.off(AppEvent.OpenDebugConsole, openDebugConsole);
    };
  }, [config]);

  useEffect(() => {
    if (ctrlCTimerRef.current) {
      clearTimeout(ctrlCTimerRef.current);
      ctrlCTimerRef.current = null;
    }
    if (ctrlCPressCount > 1) {
      void handleSlashCommand('/quit', undefined, false);
    } else {
      ctrlCTimerRef.current = setTimeout(() => {
        setCtrlCPressCount(0);
        ctrlCTimerRef.current = null;
      }, WARNING_PROMPT_DURATION_MS);
    }
  }, [ctrlCPressCount, config, setCtrlCPressCount, handleSlashCommand]);

  useEffect(() => {
    if (ctrlDTimerRef.current) {
      clearTimeout(ctrlDTimerRef.current);
      ctrlCTimerRef.current = null;
    }
    if (ctrlDPressCount > 1) {
      void handleSlashCommand('/quit', undefined, false);
    } else {
      ctrlDTimerRef.current = setTimeout(() => {
        setCtrlDPressCount(0);
        ctrlDTimerRef.current = null;
      }, WARNING_PROMPT_DURATION_MS);
    }
  }, [ctrlDPressCount, config, setCtrlDPressCount, handleSlashCommand]);

  const handleEscapePromptChange = useCallback((showPrompt: boolean) => {
    setShowEscapePrompt(showPrompt);
  }, []);

  const { elapsedTime, currentLoadingPhrase } = useLoadingIndicator({
    streamingState,
    shouldShowFocusHint,
    customWittyPhrases: settings.merged.ui.customWittyPhrases,
  });

  const handleGlobalKeypress = useCallback(
    (key: Key) => {
      if (copyModeEnabled) {
        setCopyModeEnabled(false);
        enableMouseEvents();
        // We don't want to process any other keys if we're in copy mode.
        return;
      }

      // Debug log keystrokes if enabled
      if (settings.merged.general.debugKeystrokeLogging) {
        debugLogger.log('[DEBUG] Keystroke:', JSON.stringify(key));
      }

      if (isAlternateBuffer && keyMatchers[Command.TOGGLE_COPY_MODE](key)) {
        setCopyModeEnabled(true);
        disableMouseEvents();
        return;
      }

      if (keyMatchers[Command.QUIT](key)) {
        if (pendingApproval !== undefined) {
          approvalRuntime.respond(pendingApproval.id, 'cancelled');
          return;
        }
        if (pendingUserQuestion !== undefined) {
          userQuestionRuntime.cancel(pendingUserQuestion.id);
          return;
        }
        if (conversationRuntime) {
          if (
            promptInputPreparing ||
            localShellExecuting ||
            isProcessing ||
            conversationSnapshot.busy
          ) {
            cancelOngoingRequest();
          } else {
            void handleSlashCommand('/quit', undefined, false);
          }
          return;
        }

        // If the user presses Ctrl+C, we want to cancel any ongoing requests.
        // This should happen regardless of the count.
        cancelOngoingRequest?.();

        setCtrlCPressCount((prev) => prev + 1);
        return;
      } else if (keyMatchers[Command.EXIT](key)) {
        if (buffer.text.length > 0) {
          return;
        }
        setCtrlDPressCount((prev) => prev + 1);
        return;
      }

      let enteringConstrainHeightMode = false;
      if (!constrainHeight) {
        enteringConstrainHeightMode = true;
        setConstrainHeight(true);
      }

      if (keyMatchers[Command.SHOW_ERROR_DETAILS](key)) {
        setShowErrorDetails((prev) => !prev);
      } else if (keyMatchers[Command.SHOW_FULL_TODOS](key)) {
        setShowFullTodos((prev) => !prev);
      } else if (keyMatchers[Command.TOGGLE_MARKDOWN](key)) {
        setRenderMarkdown((prev) => {
          const newValue = !prev;
          // Force re-render of static content
          refreshStatic();
          return newValue;
        });
      } else if (
        keyMatchers[Command.SHOW_MORE_LINES](key) &&
        !enteringConstrainHeightMode
      ) {
        setConstrainHeight(false);
      } else if (
        keyMatchers[Command.UNFOCUS_SHELL_INPUT](key) &&
        activePtyId &&
        embeddedShellFocused
      ) {
        if (key.name === 'tab' && key.shift) {
          // Always change focus
          setEmbeddedShellFocused(false);
          return;
        }

        const now = Date.now();
        // If the shell hasn't produced output in the last 100ms, it's considered idle.
        const isIdle = now - lastOutputTimeRef.current >= 100;
        if (isIdle) {
          if (tabFocusTimeoutRef.current) {
            clearTimeout(tabFocusTimeoutRef.current);
          }
          tabFocusTimeoutRef.current = setTimeout(() => {
            tabFocusTimeoutRef.current = null;
            // If the shell produced output since the tab press, we assume it handled the tab
            // (e.g. autocomplete) so we should not toggle focus.
            if (lastOutputTimeRef.current > now) {
              handleWarning('Press Shift+Tab to focus out.');
              return;
            }
            setEmbeddedShellFocused(false);
          }, 100);
          return;
        }
        handleWarning('Press Shift+Tab to focus out.');
      }
    },
    [
      constrainHeight,
      setConstrainHeight,
      setShowErrorDetails,
      setCtrlCPressCount,
      buffer.text.length,
      setCtrlDPressCount,
      handleSlashCommand,
      cancelOngoingRequest,
      conversationRuntime,
      conversationSnapshot.busy,
      promptInputPreparing,
      localShellExecuting,
      isProcessing,
      pendingApproval,
      approvalRuntime,
      pendingUserQuestion,
      userQuestionRuntime,
      activePtyId,
      embeddedShellFocused,
      settings.merged.general.debugKeystrokeLogging,
      refreshStatic,
      setCopyModeEnabled,
      copyModeEnabled,
      isAlternateBuffer,
      handleWarning,
    ],
  );
  useKeypress(handleGlobalKeypress, { isActive: true });

  useEffect(() => {
    // Respect hideWindowTitle settings
    if (settings.merged.ui.hideWindowTitle) return;

    const paddedTitle = computeTerminalTitle({
      streamingState,
      isConfirming:
        pendingApproval !== undefined ||
        !!confirmationRequest ||
        shouldShowActionRequiredTitle,
      isSilentWorking: shouldShowSilentWorkingTitle,
      folderName: basename(config.getTargetDir()),
      useDynamicTitle: settings.merged.ui.dynamicWindowTitle,
    });

    // Only update the title if it's different from the last value we set
    if (lastTitleRef.current !== paddedTitle) {
      lastTitleRef.current = paddedTitle;
      stdout.write(`\x1b]0;${paddedTitle}\x07`);
    }
    // Note: We don't need to reset the window title on exit because DSH Console is already doing that elsewhere
  }, [
    streamingState,
    confirmationRequest,
    pendingApproval,
    shouldShowActionRequiredTitle,
    shouldShowSilentWorkingTitle,
    settings.merged.ui.dynamicWindowTitle,
    settings.merged.ui.hideWindowTitle,
    config,
    stdout,
  ]);

  useEffect(() => {
    const handleUserFeedback = (payload: UserFeedbackPayload) => {
      let type: MessageType;
      switch (payload.severity) {
        case 'error':
          type = MessageType.ERROR;
          break;
        case 'warning':
          type = MessageType.WARNING;
          break;
        case 'info':
          type = MessageType.INFO;
          break;
        default:
          throw new Error(
            `Unexpected severity for user feedback: ${payload.severity}`,
          );
      }

      historyManager.addItem(
        {
          type,
          text: payload.message,
        },
        Date.now(),
      );

      // If there is an attached error object, log it to the debug drawer.
      if (payload.error) {
        debugLogger.warn(
          `[Feedback Details for "${payload.message}"]`,
          payload.error,
        );
      }
    };

    coreEvents.on(CoreEvent.UserFeedback, handleUserFeedback);

    // Flush any messages that happened during startup before this component
    // mounted.
    coreEvents.drainBacklogs();

    return () => {
      coreEvents.off(CoreEvent.UserFeedback, handleUserFeedback);
    };
  }, [historyManager]);

  const filteredConsoleMessages = useMemo(() => {
    if (config.getDebugMode()) {
      return consoleMessages;
    }
    return consoleMessages.filter((msg) => msg.type !== 'debug');
  }, [consoleMessages, config]);

  // Computed values
  const errorCount = useMemo(
    () =>
      filteredConsoleMessages
        .filter((msg) => msg.type === 'error')
        .reduce((total, msg) => total + msg.count, 0),
    [filteredConsoleMessages],
  );

  const nightly = props.version.includes('nightly');

  const dialogsVisible =
    pendingUserQuestion !== undefined ||
    !!confirmationRequest ||
    !!customDialog ||
    isThemeDialogOpen ||
    isSettingsDialogOpen ||
    isEditorDialogOpen;

  const pendingHistoryItems = useMemo(
    () => (pendingShellHistoryItem ? [pendingShellHistoryItem] : []),
    [pendingShellHistoryItem],
  );

  const uiState: UIState = useMemo(
    () => ({
      history: historyManager.history,
      isThemeDialogOpen,
      themeError,
      editorError,
      isEditorDialogOpen,
      debugMessage,
      quittingMessages,
      isSettingsDialogOpen,
      slashCommands,
      commandContext,
      confirmationRequest,
      streamingState,
      initError,
      todos,
      shellModeActive,
      userMessages: inputHistory,
      buffer,
      inputWidth,
      suggestionsWidth,
      isInputActive,
      promptCompletionRuntime,
      constrainHeight,
      showErrorDetails,
      showFullTodos,
      filteredConsoleMessages,
      renderMarkdown,
      ctrlCPressedOnce: ctrlCPressCount >= 1,
      ctrlDPressedOnce: ctrlDPressCount >= 1,
      showEscapePrompt,
      isFocused,
      elapsedTime,
      currentLoadingPhrase,
      historyRemountKey,
      messageQueue,
      queueErrorMessage,
      currentModel,
      errorCount,
      availableTerminalHeight,
      mainAreaWidth,
      staticAreaMaxItemHeight,
      staticExtraHeight,
      dialogsVisible,
      pendingHistoryItems,
      nightly,
      branchName,
      sessionStats,
      terminalWidth,
      terminalHeight,
      mainControlsRef,
      rootUiRef,
      activePtyId,
      embeddedShellFocused,
      showDebugProfiler,
      customDialog,
      copyModeEnabled,
      warningMessage,
      terminalBackgroundColor: config.getTerminalBackground(),
      settingsNonce,
    }),
    [
      isThemeDialogOpen,
      themeError,
      editorError,
      isEditorDialogOpen,
      debugMessage,
      quittingMessages,
      isSettingsDialogOpen,
      slashCommands,
      commandContext,
      confirmationRequest,
      streamingState,
      initError,
      todos,
      shellModeActive,
      inputHistory,
      buffer,
      inputWidth,
      suggestionsWidth,
      isInputActive,
      promptCompletionRuntime,
      constrainHeight,
      showErrorDetails,
      showFullTodos,
      filteredConsoleMessages,
      renderMarkdown,
      ctrlCPressCount,
      ctrlDPressCount,
      showEscapePrompt,
      isFocused,
      elapsedTime,
      currentLoadingPhrase,
      historyRemountKey,
      messageQueue,
      queueErrorMessage,
      errorCount,
      availableTerminalHeight,
      mainAreaWidth,
      staticAreaMaxItemHeight,
      staticExtraHeight,
      dialogsVisible,
      pendingHistoryItems,
      nightly,
      branchName,
      sessionStats,
      terminalWidth,
      terminalHeight,
      mainControlsRef,
      rootUiRef,
      currentModel,
      activePtyId,
      historyManager,
      embeddedShellFocused,
      showDebugProfiler,
      customDialog,
      copyModeEnabled,
      warningMessage,
      config,
      settingsNonce,
    ],
  );

  const uiActions: UIActions = useMemo(
    () => ({
      handleThemeSelect,
      closeThemeDialog,
      handleThemeHighlight,
      handleEditorSelect,
      exitEditorDialog,
      closeSettingsDialog,
      setShellModeActive,
      vimHandleInput,
      setConstrainHeight,
      onEscapePromptChange: handleEscapePromptChange,
      refreshStatic,
      handleFinalSubmit,
      handleClearScreen,
      setQueueErrorMessage,
      popAllMessages,
      setEmbeddedShellFocused,
      handleRestart: async () => {
        await runExitCleanup();
        process.exit(RESTART_EXIT_CODE);
      },
    }),
    [
      handleThemeSelect,
      closeThemeDialog,
      handleThemeHighlight,
      handleEditorSelect,
      exitEditorDialog,
      closeSettingsDialog,
      setShellModeActive,
      vimHandleInput,
      setConstrainHeight,
      handleEscapePromptChange,
      refreshStatic,
      handleFinalSubmit,
      handleClearScreen,
      setQueueErrorMessage,
      popAllMessages,
      setEmbeddedShellFocused,
    ],
  );

  return (
    <UIStateContext.Provider value={uiState}>
      <UIActionsContext.Provider value={uiActions}>
        <ConfigContext.Provider value={config}>
          <AppContext.Provider
            value={{
              version: props.version,
              startupWarnings: props.startupWarnings || [],
            }}
          >
            <ApprovalRuntimeProvider runtime={approvalRuntime}>
              <UserQuestionRuntimeProvider runtime={userQuestionRuntime}>
                <ShellFocusContext.Provider value={isFocused}>
                  <App />
                </ShellFocusContext.Provider>
              </UserQuestionRuntimeProvider>
            </ApprovalRuntimeProvider>
          </AppContext.Provider>
        </ConfigContext.Provider>
      </UIActionsContext.Provider>
    </UIStateContext.Provider>
  );
};
