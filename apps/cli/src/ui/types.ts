/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ReactNode } from 'react';
import type { ToolResultDisplay } from './tool-result.js';
import type { ConversationContentBlock } from './conversation-runtime.js';

// Only defining the state enum needed by the UI
export enum StreamingState {
  Idle = 'idle',
  Responding = 'responding',
}

// Copied from server/src/core/turn.ts for CLI usage
export enum AgentEventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  // Add other event types if the UI hook needs to handle them
}

export enum ToolCallStatus {
  Pending = 'Pending',
  Canceled = 'Canceled',
  Executing = 'Executing',
  Success = 'Success',
  Error = 'Error',
}

export interface ToolCallEvent {
  type: 'tool_call';
  status: ToolCallStatus;
  callId: string;
  name: string;
  args: Record<string, never>;
  resultDisplay: ToolResultDisplay | undefined;
}

export interface IndividualToolCallDisplay {
  callId: string;
  name: string;
  description: string;
  resultDisplay: ToolResultDisplay | undefined;
  presentation?: {
    kind: 'compact';
    label: string;
  };
  status: ToolCallStatus;
  renderOutputAsMarkdown?: boolean;
  ptyId?: number;
  outputFile?: string;
}

/**
 * For use when you want no icon.
 */
export const emptyIcon = '  ';

export interface HistoryItemBase {
  text?: string; // Text content for user/agent/info/error messages
}

export type HistoryItemUser = HistoryItemBase & {
  type: 'user';
  text: string;
};

export type HistoryItemDshAssistant = HistoryItemBase & {
  type: 'dsh_assistant';
  content: readonly ConversationContentBlock[];
  interrupted: boolean;
};

export type HistoryItemDshUser = HistoryItemBase & {
  type: 'dsh_user';
  content: readonly ConversationContentBlock[];
};

export type HistoryItemInfo = HistoryItemBase & {
  type: 'info';
  text: string;
  icon?: string;
  color?: string;
};

export type HistoryItemError = HistoryItemBase & {
  type: 'error';
  text: string;
};

export type HistoryItemWarning = HistoryItemBase & {
  type: 'warning';
  text: string;
};

export type HistoryItemAbout = HistoryItemBase & {
  type: 'about';
  cliVersion: string;
  osVersion: string;
  modelVersion: string;
};

export type HistoryItemHelp = HistoryItemBase & {
  type: 'help';
  timestamp: Date;
};

export type HistoryItemStats = HistoryItemBase & {
  type: 'stats';
  duration: string;
};

export type HistoryItemModel = HistoryItemBase & {
  type: 'model';
  model: string;
};

export type HistoryItemQuit = HistoryItemBase & {
  type: 'quit';
  duration: string;
};

export type HistoryItemToolGroup = HistoryItemBase & {
  type: 'tool_group';
  tools: IndividualToolCallDisplay[];
};

export type HistoryItemUserShell = HistoryItemBase & {
  type: 'user_shell';
  text: string;
};

// Using Omit<HistoryItem, 'id'> seems to have some issues with typescript's
// type inference e.g. historyItem.type === 'tool_group' isn't auto-inferring that
// 'tools' in historyItem.
// Individually exported types extending HistoryItemBase
export type HistoryItemWithoutId =
  | HistoryItemUser
  | HistoryItemUserShell
  | HistoryItemDshAssistant
  | HistoryItemDshUser
  | HistoryItemInfo
  | HistoryItemError
  | HistoryItemWarning
  | HistoryItemAbout
  | HistoryItemHelp
  | HistoryItemToolGroup
  | HistoryItemStats
  | HistoryItemModel
  | HistoryItemQuit;

export type HistoryItem = HistoryItemWithoutId & { id: number };

// Message types used by internal command feedback (subset of HistoryItem types)
export enum MessageType {
  INFO = 'info',
  ERROR = 'error',
  WARNING = 'warning',
  USER = 'user',
}

export interface ConsoleMessageItem {
  type: 'log' | 'warn' | 'error' | 'debug' | 'info';
  content: string;
  count: number;
}

export type SlashCommandProcessorResult = {
  type: 'handled';
};

export interface ConfirmationRequest {
  prompt: ReactNode;
  onConfirm: (confirm: boolean) => void;
}
