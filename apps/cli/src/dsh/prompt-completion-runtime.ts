/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import {
  installModelSelection,
  type AgentHandle,
  type CreateAgentOptions,
  type ModelSelection,
  type ModelSelectionRef,
} from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import {
  SessionId,
  type Session,
  type SessionEvent,
} from '@deepseek-ai/dsh-session';
import { debugLogger } from '@cofy-x/dsh-console-core';
import type { PromptCompletionRuntime } from '../ui/prompt-completion-runtime.js';

export interface DshPromptCompletionServices {
  createAgent(options: CreateAgentOptions): Promise<AgentHandle>;
  onSessionEvent(
    listener: (session: Session, event: SessionEvent) => void,
  ): () => void;
}

function completionPrompt(text: string): string {
  return [
    'Complete the partial user prompt concisely and precisely.',
    'Return plain text only, with no explanation or formatting.',
    'The response must begin with the exact original input.',
    'Match the language of the input and add only useful actionable detail.',
    `Original input: ${JSON.stringify(text)}`,
  ].join('\n');
}

function finalAssistantText(event: SessionEvent<'assistant/message'>): string {
  return event.data.message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export class DshPromptCompletionRuntime implements PromptCompletionRuntime {
  private disposed = false;
  private activeController: AbortController | undefined;
  private activeOperation: Promise<string | null> | undefined;

  constructor(
    private readonly services: DshPromptCompletionServices,
    private readonly selection: ModelSelection | (() => ModelSelection),
  ) {}

  private currentSelection(): ModelSelection {
    return typeof this.selection === 'function' ? this.selection() : this.selection;
  }

  complete = async (
    text: string,
    signal: AbortSignal,
  ): Promise<string | null> => {
    this.activeController?.abort();
    await this.activeOperation;
    if (this.disposed || signal.aborted) return null;

    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    this.activeController = controller;

    const operation = this.runCompletion(text, controller.signal);
    this.activeOperation = operation;
    try {
      return await operation;
    } finally {
      signal.removeEventListener('abort', abort);
      if (this.activeOperation === operation) {
        this.activeOperation = undefined;
        this.activeController = undefined;
      }
    }
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) return;
    this.disposed = true;
    this.activeController?.abort();
    await this.activeOperation;
  };

  private async runCompletion(
    text: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    let handle: AgentHandle | undefined;
    let off = () => {};
    try {
      const selection = this.currentSelection();
      handle = await this.services.createAgent({
        sessionId: SessionId(`dsh-console-completion-${randomUUID()}`),
        meta: { cwd: process.cwd() },
        agentOptions: {
          provider: selection.provider,
          model: selection.model,
          ...(selection.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: selection.reasoningEffort }),
        },
        signal,
        setup: (agentCtx) => {
          const selected: ModelSelectionRef = {
            current: selection,
            assembled: undefined,
          };
          installModelSelection(agentCtx, selected);
        },
      });
      if (signal.aborted) return null;

      let textResult = '';
      let failureKind: string | undefined;
      off = this.services.onSessionEvent((session, event) => {
        if (session.id !== handle?.agent.session.id) return;
        if (
          event.type === 'assistant/chunk' &&
          event.data.chunk.type === 'text-delta'
        ) {
          textResult += event.data.chunk.text;
        } else if (event.type === 'assistant/message') {
          textResult = finalAssistantText(event) || textResult;
        } else if (event.type === 'turn/end') {
          if (event.data.reason.kind !== 'completed') {
            failureKind = event.data.reason.kind;
          }
        }
      });

      const cancel = () => handle?.agent.cancel({ kind: 'user' });
      signal.addEventListener('abort', cancel, { once: true });
      try {
        handle.agent.followup(
          createUserMessage({
            content: [{ type: 'text', text: completionPrompt(text) }],
            source: { kind: 'user' },
          }),
        );
        await handle.agent.whenIdle();
      } finally {
        signal.removeEventListener('abort', cancel);
      }

      if (signal.aborted) return null;
      if (failureKind) {
        debugLogger.debug(`Prompt completion turn ended: ${failureKind}`);
        return null;
      }
      const result = textResult.trim();
      return result.startsWith(text) ? result : null;
    } catch (error) {
      if (!signal.aborted) {
        debugLogger.debug(
          `Prompt completion failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    } finally {
      off();
      await handle?.dispose();
    }
  }
}
