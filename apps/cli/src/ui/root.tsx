/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  startupProfiler,
  patchStdio,
  debugLogger,
  writeToStderr,
  coreEvents,
  shouldEnterAlternateScreen,
  enterAlternateScreen,
  disableLineWrapping,
  enableMouseEvents,
  disableMouseEvents,
  initializeOutputListenersAndFlush,
  createWorkingStdio,
} from '@cofy-x/dsh-console-core';
import { ExitCodes } from '../utils/exit-codes.js';
import { getVersion } from '../utils/version.js';
import * as dns from 'node:dns';
import {
  registerCleanup,
  registerSyncCleanup,
  runExitCleanup,
} from '../utils/cleanup.js';
import { AppEvent, appEvents } from '../utils/events.js';
import { type LoadedSettings, loadSettings } from '../config/user-settings.js';
import {
  parseArguments,
  isDebugMode as isDebugModeCli,
} from '../config/cli-args.js';
import { ConsolePatcher } from '../utils/console-patcher.js';
import type { DnsResolutionOrder } from '../config/settings-schema.js';
import { loadCliConfig } from '../config/config-loader.js';
import type { InitializationResult } from './initialization-result.js';
import { isAlternateBufferEnabled } from './hooks/terminal/use-alternate-buffer.js';
import { setupTerminalAndTheme } from '../terminal/theme-init.js';
import { getStartupWarnings } from '../bootstrap/startup-warnings.js';
import type { Config } from '../config/config.js';
import { basename } from 'node:path';
import { setWindowTitle } from '../terminal/window-title.js';
import { AppContainer } from './app-container.js';
import React from 'react';
import { render } from 'ink';
import { useKittyKeyboardProtocol } from './hooks/terminal/use-kitty-keyboard-protocol.js';
import { SettingsContext } from './contexts/settings-context.js';
import { KeypressProvider } from './contexts/keypress-context.js';
import { MouseProvider } from './contexts/mouse-context.js';
import { ScrollProvider } from './contexts/scroll-provider.js';
import { SessionStatsProvider } from './contexts/session-context.js';
import { VimModeProvider } from './contexts/vim-mode-context.js';
import { profiler } from './components/stats/debug-profiler.js';
import type { ConversationRuntime } from './conversation-runtime.js';
import type { PromptCompletionRuntime } from './prompt-completion-runtime.js';
import type { PromptInputRuntime } from './prompt-input-runtime.js';
import type { ModelSelectionRuntime } from './model-selection-runtime.js';
import type { SessionManagementRuntime } from './session-management-runtime.js';
import type { ApprovalRuntime } from './approval-runtime.js';
import type { UserQuestionRuntime } from './user-question-runtime.js';
import type { DshCommandRuntime } from './command-runtime.js';
import type { ToolCatalogRuntime } from './tool-catalog-runtime.js';
import type { PermissionSelectionRuntime } from './permission-selection-runtime.js';

const SLOW_RENDER_MS = 200;

export function validateDnsResolutionOrder(
  order: string | undefined,
): DnsResolutionOrder {
  const defaultValue: DnsResolutionOrder = 'ipv4first';
  if (order === undefined) {
    return defaultValue;
  }
  if (order === 'ipv4first' || order === 'verbatim') {
    return order;
  }
  // We don't want to throw here, just warn and use the default.
  debugLogger.warn(
    `Invalid value for dnsResolutionOrder in settings: "${order}". Using default "${defaultValue}".`,
  );
  return defaultValue;
}

export function setupUnhandledRejectionHandler() {
  let unhandledRejectionOccurred = false;
  process.on('unhandledRejection', (reason, _promise) => {
    const errorMessage = `=========================================
This is an unexpected error. Please file a bug report using the /bug tool.
CRITICAL: Unhandled Promise Rejection!
=========================================
Reason: ${reason}${
      reason instanceof Error && reason.stack
        ? `
Stack trace:
${reason.stack}`
        : ''
    }`;
    debugLogger.error(errorMessage);
    if (!unhandledRejectionOccurred) {
      unhandledRejectionOccurred = true;
      appEvents.emit(AppEvent.OpenDebugConsole);
    }
  });
}

export async function startInteractiveUI(
  config: Config,
  settings: LoadedSettings,
  startupWarnings: string[],
  workspaceRoot: string = process.cwd(),
  initializationResult: InitializationResult,
  conversationRuntime: ConversationRuntime,
  approvalRuntime: ApprovalRuntime,
  userQuestionRuntime: UserQuestionRuntime,
  commandRuntime: DshCommandRuntime,
  permissionSelectionRuntime: PermissionSelectionRuntime,
  toolCatalogRuntime: ToolCatalogRuntime,
  promptCompletionRuntime?: PromptCompletionRuntime,
  promptInputRuntime?: PromptInputRuntime,
  modelSelectionRuntime?: ModelSelectionRuntime,
  sessionManagementRuntime?: SessionManagementRuntime,
  initialPrompt?: string,
) {
  // Never enter Ink alternate buffer mode when screen reader mode is enabled
  // as there is no benefit of alternate buffer mode when using a screen reader
  // and the Ink alternate buffer mode requires line wrapping harmful to
  // screen readers.
  const useAlternateBuffer = shouldEnterAlternateScreen(
    isAlternateBufferEnabled(settings),
    config.getScreenReader(),
  );
  const mouseEventsEnabled = useAlternateBuffer;
  if (mouseEventsEnabled) {
    enableMouseEvents();
    registerCleanup(() => {
      disableMouseEvents();
    });
  }

  // Window title setup
  setWindowTitle(basename(workspaceRoot), settings);

  // App wrapper setup
  const version = await getVersion();
  // Create wrapper component to use hooks inside render
  const AppWrapper = () => {
    useKittyKeyboardProtocol();
    return (
      <SettingsContext.Provider value={settings}>
        <KeypressProvider
          config={config}
          debugKeystrokeLogging={settings.merged.general.debugKeystrokeLogging}
        >
          <MouseProvider
            mouseEventsEnabled={mouseEventsEnabled}
            debugKeystrokeLogging={
              settings.merged.general.debugKeystrokeLogging
            }
          >
            <ScrollProvider>
              <SessionStatsProvider conversationRuntime={conversationRuntime}>
                <VimModeProvider settings={settings}>
                  <AppContainer
                    config={config}
                    startupWarnings={startupWarnings}
                    version={version}
                    initializationResult={initializationResult}
                    conversationRuntime={conversationRuntime}
                    promptCompletionRuntime={promptCompletionRuntime}
                    promptInputRuntime={promptInputRuntime}
                    modelSelectionRuntime={modelSelectionRuntime}
                    sessionManagementRuntime={sessionManagementRuntime}
                    approvalRuntime={approvalRuntime}
                    userQuestionRuntime={userQuestionRuntime}
                    commandRuntime={commandRuntime}
                    permissionSelectionRuntime={permissionSelectionRuntime}
                    toolCatalogRuntime={toolCatalogRuntime}
                    initialPrompt={initialPrompt}
                  />
                </VimModeProvider>
              </SessionStatsProvider>
            </ScrollProvider>
          </MouseProvider>
        </KeypressProvider>
      </SettingsContext.Provider>
    );
  };

  // Ink instance setup
  const { stdout: inkStdout, stderr: inkStderr } = createWorkingStdio();
  const instance = render(
    process.env['DEBUG'] ? (
      <React.StrictMode>
        <AppWrapper />
      </React.StrictMode>
    ) : (
      <AppWrapper />
    ),
    {
      stdout: inkStdout,
      stderr: inkStderr,
      stdin: process.stdin,
      exitOnCtrlC: false,
      isScreenReaderEnabled: config.getScreenReader(),
      onRender: ({ renderTime }: { renderTime: number }) => {
        if (renderTime > SLOW_RENDER_MS) {
          debugLogger.debug(`[UI] Slow render: ${renderTime.toFixed(1)}ms`);
        }
        profiler.reportFrameRendered();
      },
      patchConsole: false,
      alternateBuffer: useAlternateBuffer,
      incrementalRendering:
        settings.merged.ui.incrementalRendering !== false && useAlternateBuffer,
    },
  );
  registerCleanup(() => instance.unmount());
}

export interface MainOptions {
  conversationRuntime: ConversationRuntime;
  promptCompletionRuntime?: PromptCompletionRuntime;
  promptInputRuntime?: PromptInputRuntime;
  modelSelectionRuntime?: ModelSelectionRuntime;
  sessionManagementRuntime?: SessionManagementRuntime;
  approvalRuntime: ApprovalRuntime;
  userQuestionRuntime: UserQuestionRuntime;
  commandRuntime: DshCommandRuntime;
  permissionSelectionRuntime: PermissionSelectionRuntime;
  toolCatalogRuntime: ToolCatalogRuntime;
  initialPrompt?: string;
  argv?: string[];
}

export async function main(options: MainOptions) {
  const cliStartupHandle = startupProfiler.start('cli_startup');
  const cleanupStdio = patchStdio();
  registerSyncCleanup(() => {
    // This is needed to ensure we don't lose any buffered output.
    initializeOutputListenersAndFlush();
    cleanupStdio();
  });
  setupUnhandledRejectionHandler();

  // Load settings
  const loadSettingsHandle = startupProfiler.start('load_settings');
  const settings = loadSettings();
  loadSettingsHandle?.end();

  // Report settings errors once during startup
  settings.errors.forEach((error) => {
    coreEvents.emitFeedback('warning', error.message);
  });

  // Parse arguments
  const parseArgsHandle = startupProfiler.start('parse_arguments');
  const argv = await parseArguments(settings.merged, options.argv);
  parseArgsHandle?.end();

  if (argv.startupMessages) {
    argv.startupMessages.forEach((msg) => {
      coreEvents.emitFeedback('info', msg);
    });
  }

  // Check for invalid input combinations early to prevent crashes
  if (argv.promptInteractive && !process.stdin.isTTY) {
    writeToStderr(
      'Error: The --prompt-interactive flag cannot be used when input is piped from stdin.\n',
    );
    await runExitCleanup();
    process.exit(ExitCodes.FATAL_INPUT_ERROR);
  }

  // Console patcher
  const isDebugMode = isDebugModeCli(argv);
  const consolePatcher = new ConsolePatcher({
    debugMode: isDebugMode,
    onNewMessage: (msg) => {
      coreEvents.emitConsoleLog(msg.type, msg.content);
    },
  });
  consolePatcher.patch();
  registerCleanup(consolePatcher.cleanup);

  // DNS resolution order
  dns.setDefaultResultOrder(
    validateDnsResolutionOrder(settings.merged.advanced.dnsResolutionOrder),
  );

  {
    // Load CLI config
    const loadConfigHandle = startupProfiler.start('load_cli_config');
    const config = await loadCliConfig(settings.merged, argv);
    loadConfigHandle?.end();

    const wasRaw = process.stdin.isRaw;
    if (config.isInteractive() && !wasRaw && process.stdin.isTTY) {
      // Set this as early as possible to avoid spurious characters from
      // input showing up in the output.
      process.stdin.setRawMode(true);

      if (
        shouldEnterAlternateScreen(
          isAlternateBufferEnabled(settings),
          config.getScreenReader(),
        )
      ) {
        enterAlternateScreen();
        disableLineWrapping();

        // Ink will cleanup so there is no need for us to manually cleanup.
      }

      // This cleanup isn't strictly needed but may help in certain situations.
      process.on('SIGTERM', () => {
        process.stdin.setRawMode(wasRaw);
      });
      process.on('SIGINT', () => {
        process.stdin.setRawMode(wasRaw);
      });
    }

    // Setup terminal and theme
    await setupTerminalAndTheme(config, settings);

    const initResult: InitializationResult = {
      initError: null,
      themeError: null,
    };

    const startupWarnings = await getStartupWarnings(settings.merged);

    cliStartupHandle?.end();
    await startInteractiveUI(
      config,
      settings,
      startupWarnings,
      process.cwd(),
      initResult,
      options.conversationRuntime,
      options.approvalRuntime,
      options.userQuestionRuntime,
      options.commandRuntime,
      options.permissionSelectionRuntime,
      options.toolCatalogRuntime,
      options.promptCompletionRuntime,
      options.promptInputRuntime,
      options.modelSelectionRuntime,
      options.sessionManagementRuntime,
      options.initialPrompt,
    );
  }
}
