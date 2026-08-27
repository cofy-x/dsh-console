/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import type { UseHistoryManagerReturn } from '../session/use-history-manager.js';
import { useSessionStats } from '../../contexts/session-context.js';
import type {
  SlashCommandProcessorResult,
  HistoryItem,
} from '../../types.js';
import { MessageType } from '../../types.js';
import {
  type CommandActionContext,
  type CommandContext,
  type SlashCommand,
} from '../../commands/types.js';
import { CommandService } from '../../../services/command-service.js';
import { BuiltinCommandLoader } from '../../../services/builtin-command-loader.js';
import { parseSlashCommand } from '../../commands/parser.js';
import type { ModelSelectionRuntime } from '../../model-selection-runtime.js';
import type { SessionManagementRuntime } from '../../session-management-runtime.js';
import type { DshCommandRuntime } from '../../command-runtime.js';
import type { ToolCatalogRuntime } from '../../tool-catalog-runtime.js';
import { DshCommandLoader } from '../../../services/dsh-command-loader.js';
import type { PermissionSelectionRuntime } from '../../permission-selection-runtime.js';
import type { ProviderSetupRuntime } from '../../provider-setup-runtime.js';
import type { SideConversationRuntime } from '../../conversation-workspace-runtime.js';

interface SlashCommandProcessorActions {
  openThemeDialog: () => void;
  openEditorDialog: () => void;
  openSettingsDialog: () => void;
  quit: (messages: HistoryItem[]) => void;
  toggleDebugProfiler: () => void;
  setText: (text: string) => void;
}

/**
 * Hook to define and process slash commands (e.g., /help, /clear).
 */
export const useSlashCommandProcessor = (
  addItem: UseHistoryManagerReturn['addItem'],
  clearItems: UseHistoryManagerReturn['clearItems'],
  loadHistory: UseHistoryManagerReturn['loadHistory'],
  refreshStatic: () => void,
  toggleVimEnabled: () => Promise<boolean>,
  setIsProcessing: (isProcessing: boolean) => void,
  actions: SlashCommandProcessorActions,
  setCustomDialog: (dialog: React.ReactNode | null) => void,
  modelSelection?: ModelSelectionRuntime,
  permissionSelection?: PermissionSelectionRuntime,
  sessionManagement?: SessionManagementRuntime,
  toolCatalog?: ToolCatalogRuntime,
  dshCommands?: DshCommandRuntime,
  enableProfiler = false,
  providerSetup?: ProviderSetupRuntime,
  sideConversation?: SideConversationRuntime,
) => {
  const session = useSessionStats();
  const [commands, setCommands] = useState<readonly SlashCommand[] | undefined>(
    undefined,
  );
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const commandAbortRef = useRef<AbortController | undefined>(undefined);

  const reloadCommands = useCallback(() => {
    setReloadTrigger((v) => v + 1);
  }, []);
  const [confirmationRequest, setConfirmationRequest] = useState<null | {
    prompt: React.ReactNode;
    onConfirm: (confirmed: boolean) => void;
  }>(null);

  const commandContext = useMemo(
    (): CommandContext => ({
      services: {
        modelSelection,
        providerSetup,
        permissionSelection,
        sessionManagement,
        toolCatalog,
        sideConversation,
      },
      ui: {
        addItem,
        clear: () => {
          clearItems();
          refreshStatic();
        },
        loadHistory: (history, postLoadInput) => {
          loadHistory(history);
          refreshStatic();
          if (postLoadInput !== undefined) {
            actions.setText(postLoadInput);
          }
        },
        toggleDebugProfiler: actions.toggleDebugProfiler,
        toggleVimEnabled,
        removeComponent: () => setCustomDialog(null),
      },
      session: {
        stats: session.stats,
      },
    }),
    [
      modelSelection,
      providerSetup,
      permissionSelection,
      sessionManagement,
      toolCatalog,
      sideConversation,
      loadHistory,
      addItem,
      clearItems,
      refreshStatic,
      session.stats,
      actions,
      toggleVimEnabled,
      setCustomDialog,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      const loaders = [
        ...(dshCommands === undefined
          ? []
          : [new DshCommandLoader(dshCommands)]),
        new BuiltinCommandLoader(enableProfiler),
      ];
      const commandService = await CommandService.create(loaders, controller.signal);
      setCommands(commandService.getCommands());
    })();

    return () => {
      controller.abort();
    };
  }, [dshCommands, enableProfiler, reloadTrigger]);

  useEffect(
    () => dshCommands?.subscribe(reloadCommands),
    [dshCommands, reloadCommands],
  );

  useEffect(
    () => () => commandAbortRef.current?.abort(),
    [],
  );

  const handleSlashCommand = useCallback(
    async (
      rawQuery: string,
      overwriteConfirmed?: boolean,
      addToHistory: boolean = true,
    ): Promise<SlashCommandProcessorResult | false> => {
      if (!commands) {
        return false;
      }

      const trimmed = rawQuery.trim();
      if (!trimmed.startsWith('/') && !trimmed.startsWith('?')) {
        return false;
      }

      setIsProcessing(true);
      const commandController = new AbortController();
      commandAbortRef.current?.abort();
      commandAbortRef.current = commandController;

      const { commandToExecute, args } = parseSlashCommand(trimmed, commands);

      if (addToHistory && commandToExecute?.recordInvocation !== false) {
        const userMessageTimestamp = Date.now();
        addItem(
          { type: MessageType.USER, text: trimmed },
          userMessageTimestamp,
        );
      }
      try {
        if (commandToExecute) {
          if (commandToExecute.action) {
            const fullCommandContext: CommandActionContext = {
              ...commandContext,
              invocation: {
                raw: trimmed,
                name: commandToExecute.name,
                args,
                signal: commandController.signal,
              },
              overwriteConfirmed,
            };

            const result = await commandToExecute.action(
              fullCommandContext,
              args,
            );

            if (result) {
              switch (result.type) {
                case 'message':
                  addItem(
                    {
                      type:
                        result.messageType === 'error'
                          ? MessageType.ERROR
                          : MessageType.INFO,
                      text: result.content,
                    },
                    Date.now(),
                  );
                  return { type: 'handled' };
                case 'dialog':
                  switch (result.dialog) {
                    case 'theme':
                      actions.openThemeDialog();
                      return { type: 'handled' };
                    case 'editor':
                      actions.openEditorDialog();
                      return { type: 'handled' };
                    case 'settings':
                      actions.openSettingsDialog();
                      return { type: 'handled' };
                    case 'help':
                      return { type: 'handled' };
                    default: {
                      const unhandled: never = result.dialog;
                      throw new Error(
                        `Unhandled slash command result: ${unhandled}`,
                      );
                    }
                  }
                case 'quit':
                  actions.quit(result.messages);
                  return { type: 'handled' };

                case 'confirm_action': {
                  const { confirmed } = await new Promise<{
                    confirmed: boolean;
                  }>((resolve) => {
                    setConfirmationRequest({
                      prompt: result.prompt,
                      onConfirm: (resolvedConfirmed) => {
                        setConfirmationRequest(null);
                        resolve({ confirmed: resolvedConfirmed });
                      },
                    });
                  });

                  if (!confirmed) {
                    addItem(
                      {
                        type: MessageType.INFO,
                        text: 'Operation cancelled.',
                      },
                      Date.now(),
                    );
                    return { type: 'handled' };
                  }

                  return await handleSlashCommand(
                    result.originalInvocation.raw,
                    true,
                    false,
                  );
                }
                case 'custom_dialog': {
                  setCustomDialog(result.component);
                  return { type: 'handled' };
                }
                default: {
                  const unhandled: never = result;
                  throw new Error(
                    `Unhandled slash command result: ${unhandled}`,
                  );
                }
              }
            }

            return { type: 'handled' };
          } else if (commandToExecute.subCommands) {
            const helpText = `Command '/${commandToExecute.name}' requires a subcommand. Available:\n${commandToExecute.subCommands
              .map((sc) => `  - ${sc.name}: ${sc.description || ''}`)
              .join('\n')}`;
            addItem({ type: MessageType.INFO, text: helpText }, Date.now());
            return { type: 'handled' };
          }
        }

        addItem(
          { type: MessageType.ERROR, text: `Unknown command: ${trimmed}` },
          Date.now(),
        );

        return { type: 'handled' };
      } catch (e: unknown) {
        addItem(
          {
            type: MessageType.ERROR,
            text: e instanceof Error ? e.message : String(e),
          },
          Date.now(),
        );
        return { type: 'handled' };
      } finally {
        if (commandAbortRef.current === commandController) {
          commandAbortRef.current = undefined;
        }
        setIsProcessing(false);
      }
    },
    [
      addItem,
      actions,
      commands,
      commandContext,
      setIsProcessing,
      setConfirmationRequest,
      setCustomDialog,
    ],
  );

  return {
    handleSlashCommand,
    slashCommands: commands,
    commandContext,
    confirmationRequest,
    cancelCommand: () => commandAbortRef.current?.abort(),
  };
};
