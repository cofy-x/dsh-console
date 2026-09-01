/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactElement, ReactNode } from 'react';
import type { HistoryItem } from '../types.js';
import type { UseHistoryManagerReturn } from '../hooks/session/use-history-manager.js';
import type { SessionStatsState } from '../contexts/session-context.js';
import type { ModelSelectionRuntime } from '../model-selection-runtime.js';
import type { SessionManagementRuntime } from '../session-management-runtime.js';
import type { ToolCatalogRuntime } from '../tool-catalog-runtime.js';
import type { PermissionSelectionRuntime } from '../permission-selection-runtime.js';
import type { ProviderSetupRuntime } from '../provider-setup-runtime.js';
import type { SideConversationRuntime } from '../conversation-workspace-runtime.js';
import type { SubagentCatalogRuntime } from '../subagent-catalog-runtime.js';

export interface CommandInvocation {
  /** The raw, untrimmed input string from the user. */
  raw: string;
  /** The primary name of the command that was matched. */
  name: string;
  /** The arguments string that follows the command name. */
  args: string;
}

export interface CommandExecutionInvocation extends CommandInvocation {
  /** Cancels the active command without cancelling the Agent turn. */
  signal: AbortSignal;
}

// Grouped dependencies for clarity and easier mocking
export interface CommandContext {
  // Parsed invocation data is available during completion and execution.
  invocation?: CommandInvocation;
  // Core services and configuration
  services: {
    modelSelection?: ModelSelectionRuntime;
    sessionManagement?: SessionManagementRuntime;
    toolCatalog?: ToolCatalogRuntime;
    permissionSelection?: PermissionSelectionRuntime;
    providerSetup?: ProviderSetupRuntime;
    sideConversation?: SideConversationRuntime;
    subagentCatalog?: SubagentCatalogRuntime;
  };
  // UI state and history management
  ui: {
    /** Adds a new item to the history display. */
    addItem: UseHistoryManagerReturn['addItem'];
    /** Clears all history items and the console screen. */
    clear: () => void;
    /**
     * Loads a new set of history items, replacing the current history.
     *
     * @param history The array of history items to load.
     * @param postLoadInput Optional text to set in the input buffer after loading history.
     */
    loadHistory: (history: HistoryItem[], postLoadInput?: string) => void;
    toggleDebugProfiler: () => void;
    toggleVimEnabled: () => Promise<boolean>;
    removeComponent: () => void;
  };
  // Session-specific data
  session: {
    stats: SessionStatsState;
  };
  // Flag to indicate if an overwrite has been confirmed
  overwriteConfirmed?: boolean;
}

export type CommandActionContext = Omit<CommandContext, 'invocation'> & {
  invocation: CommandExecutionInvocation;
};

/** The return type for a command action that results in the app quitting. */
export interface QuitActionReturn {
  type: 'quit';
  messages: HistoryItem[];
}

/**
 * The return type for a command action that needs to open a dialog.
 */
export interface OpenDialogActionReturn {
  type: 'dialog';
  props?: Record<string, unknown>;

  dialog: 'help' | 'theme' | 'editor' | 'settings';
}

/** A presentation-only message produced by a command. */
export interface MessageActionReturn {
  type: 'message';
  messageType: 'info' | 'error';
  content: string;
}

/**
 * The return type for a command action that needs to pause and request
 * confirmation for a set of shell commands before proceeding.
 */
export interface ConfirmActionReturn {
  type: 'confirm_action';
  /** The React node to display as the confirmation prompt. */
  prompt: ReactNode;
  /** The original invocation context to be re-run after confirmation. */
  originalInvocation: {
    raw: string;
  };
}

export interface OpenCustomDialogActionReturn {
  type: 'custom_dialog';
  component: ReactElement;
}

export type SlashCommandActionReturn =
  | QuitActionReturn
  | OpenDialogActionReturn
  | MessageActionReturn
  | ConfirmActionReturn
  | OpenCustomDialogActionReturn;

export enum CommandKind {
  BUILT_IN = 'built-in',
  DSH = 'dsh',
}

// The standardized contract for any command in the system.
export interface SlashCommand {
  name: string;
  altNames?: string[];
  description: string;
  inputHint?: string;
  hidden?: boolean;

  kind: CommandKind;

  /**
   * Controls whether the command auto-executes when selected with Enter.
   *
   * If true, pressing Enter on the suggestion will execute the command immediately.
   * If false or undefined, pressing Enter will autocomplete the command into the prompt window.
   */
  autoExecute?: boolean;

  /** Whether the invocation is rendered into the main transcript. Defaults to true. */
  recordInvocation?: boolean;

  /** Whether this command may execute while another Console operation is active. */
  allowWhileBusy?: boolean;

  // The action to run. Optional for parent commands that only group sub-commands.
  action?: (
    context: CommandActionContext,
    args: string, // TODO: Remove args. CommandContext now contains the complete invocation.
  ) =>
    | void
    | SlashCommandActionReturn
    | Promise<void | SlashCommandActionReturn>;

  // Provides argument completion (e.g., completing a tag for `/chat resume <tag>`).
  completion?: (
    context: CommandContext,
    partialArg: string,
  ) => Promise<string[]> | string[];

  /**
   * Whether to show the loading indicator while fetching completions.
   * Defaults to true. Set to false for fast completions to avoid flicker.
   */
  showCompletionLoading?: boolean;

  subCommands?: SlashCommand[];
}
