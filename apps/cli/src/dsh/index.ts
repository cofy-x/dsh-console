/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import {
  installModelSelection,
  type AgentHandle,
  type ModelSelection,
  type ModelSelectionRef,
} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-agent-default-model';
import type {} from '@deepseek-ai/cordis-plugin-loader';
import type {} from '@deepseek-ai/dsh-cmdline';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-attachment';
import type {} from '@deepseek-ai/dsh-session-query';
import type {} from '@deepseek-ai/dsh-user-approval';
import type {} from '@deepseek-ai/dsh-user-questions';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from '@deepseek-ai/dsh-session-projection';
import type {} from '@deepseek-ai/dsh-permission-presets';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import {
  SessionId,
  type Session,
  type SessionEvent,
} from '@deepseek-ai/dsh-session';
import { main } from '../ui/root.js';
import { runExitCleanup } from '../utils/cleanup.js';
import type {
  ConversationRuntime,
  ConversationSubmission,
} from '../ui/conversation-runtime.js';
import { DshSessionProjector } from './projector.js';
import { DshPromptCompletionRuntime } from './prompt-completion-runtime.js';
import { WorkspacePromptInputRuntime } from './prompt-input-runtime.js';
import { DshToolPresentationAdapter } from './tool-presenter.js';
import { DshAttachmentInputAdapter } from './attachment-input-adapter.js';
import { projectDshContent } from './content-projector.js';
import { debugLogger } from '@cofy-x/dsh-console-core';
import { unlink } from 'node:fs/promises';
import { DshModelSelectionRuntime } from './model-selection-runtime.js';
import { DshSessionManagementRuntime } from './session-management-runtime.js';
import { DshApprovalRuntime } from './approval-runtime.js';
import { DshUserQuestionRuntime } from './user-question-runtime.js';
import { DshCommandRuntimeAdapter } from './command-runtime.js';
import { DshToolCatalogRuntime } from './tool-catalog-runtime.js';
import { DshPermissionSelectionRuntime } from './permission-selection-runtime.js';

export const name = 'dsh-console-runner';
export const inject = [
  'agentDefaultModel',
  'agents',
  'sessions',
  'sessionQuery',
  'tools',
  'attachments',
  'llm',
  'approval',
  'userQuestions',
  'commands',
  'sessionProjections',
];

export interface Config {
  prompt?: string;
  debug?: boolean;
}

export const Config: z<Config> = z.object({
  prompt: z.string(),
  debug: z.boolean().default(false),
});

const CLEANUP_TIMEOUT_MS = 1_500;
const FORCE_EXIT_TIMEOUT_MS = 2_500;

async function start(ctx: Context, config: Config): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('dsh-console requires an interactive PTY');
  }
  await ctx.get('loader')?.await();
  const agents = ctx.get('agents');
  const defaultModel = ctx.get('agentDefaultModel');
  const sessions = ctx.get('sessions');
  const sessionQuery = ctx.get('sessionQuery');
  const tools = ctx.get('tools');
  const attachments = ctx.get('attachments');
  const llm = ctx.get('llm');
  const approval = ctx.get('approval');
  const userQuestions = ctx.get('userQuestions');
  const commands = ctx.get('commands');
  const sessionProjections = ctx.get('sessionProjections');
  const appExit = ctx.get('appExit');
  if (!attachments)
    throw new Error('dsh-console requires the DSH attachment service');
  if (!sessionQuery)
    throw new Error('dsh-console requires the DSH Session query service');
  if (!approval)
    throw new Error('dsh-console requires the DSH approval service');
  if (!userQuestions)
    throw new Error('dsh-console requires the DSH user-questions service');
  if (!commands)
    throw new Error('dsh-console requires the DSH commands service');
  if (!sessionProjections)
    throw new Error('dsh-console requires the DSH Session projection service');
  if (!agents || !defaultModel || !sessions || !tools || !llm || !appExit)
    return;

  const selection = defaultModel.currentSelection();
  let activeSelection: ModelSelection = selection;
  const runtimeListeners = new Set<() => void>();
  const notifyRuntime = (): void => {
    for (const listener of runtimeListeners) listener();
  };
  const promptCompletionRuntime = new DshPromptCompletionRuntime(
    {
      createAgent: (options) => agents.create(options),
      onSessionEvent: (listener) => ctx.on('session/event', listener),
    },
    () => activeSelection,
  );
  const promptInputRuntime = new WorkspacePromptInputRuntime();
  const attachmentInput = new DshAttachmentInputAdapter(attachments);

  const createActiveConversation = async (
    selected: ModelSelection,
    options: { resumeSessionId?: SessionId; signal?: AbortSignal } = {},
  ) => {
    const agentOptions = { provider: selected.provider, model: selected.model };
    const setup = (agentCtx: Context) => {
      const ref: ModelSelectionRef = {
        current: selected,
        assembled: undefined,
      };
      installModelSelection(agentCtx, ref);
    };
    const handle: AgentHandle =
      options.resumeSessionId === undefined
        ? await agents.create({
            sessionId: SessionId(`dsh-console-${randomUUID()}`),
            meta: { cwd: process.cwd() },
            agentOptions,
            setup,
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          })
        : await agents.resume({
            resumeSessionId: options.resumeSessionId,
            agentOptions,
            setup,
            ...(options.signal === undefined ? {} : { signal: options.signal }),
          });
    let offSession: (() => void) | undefined;
    try {
      const projector = new DshSessionProjector(
        String(handle.agent.session.id),
        String(selected.model),
        new DshToolPresentationAdapter(tools, handle.agent),
      );
      if (options.resumeSessionId !== undefined)
        projector.replay(handle.agent.session.events);
      offSession = ctx.on(
        'session/event',
        (session: Session, event: SessionEvent) => {
          if (session.id !== handle.agent.session.id) return;
          projector.project(event);
          if (event.type === 'turn/end') {
            void sessions.flush(session).catch((error: unknown) => {
              debugLogger.debug(
                `Unable to flush DSH Session ${String(session.id)}: ${String(error)}`,
              );
            });
          }
        },
      );
      const offProjector = projector.subscribe(notifyRuntime);
      return { handle, projector, offSession, offProjector };
    } catch (error) {
      offSession?.();
      try {
        await handle.dispose();
      } catch (disposeError) {
        debugLogger.debug(
          `Unable to dispose a failed DSH Agent candidate: ${String(disposeError)}`,
        );
      }
      throw error;
    }
  };

  let active = await createActiveConversation(selection);
  const approvalRuntime = new DshApprovalRuntime(
    (listener) => ctx.on('approval/request', listener),
    (agent) => agent === active.handle.agent,
  );
  const userQuestionRuntime = new DshUserQuestionRuntime(
    userQuestions,
    (agent) => agent === active.handle.agent,
  );
  const commandRuntime = new DshCommandRuntimeAdapter(
    commands,
    () => active.handle.agent,
    (listener) => ctx.on('commands/change', listener),
  );
  const permissionSelectionRuntime = new DshPermissionSelectionRuntime(
    sessionProjections,
    commandRuntime,
    () => active.handle.agent,
  );
  const toolCatalogRuntime = new DshToolCatalogRuntime(
    tools,
    () => active.handle.agent,
    (listener) => ctx.on('tools/change', listener),
  );
  let switchingConversation = false;
  const isConversationBusy = (): boolean =>
    switchingConversation ||
    active.projector.getSnapshot().busy ||
    approvalRuntime.getSnapshot().pending.length > 0 ||
    userQuestionRuntime.getSnapshot().pending.length > 0 ||
    permissionSelectionRuntime.getSnapshot().busy;
  const switchActiveConversation = async (
    selected: ModelSelection,
    options: { resumeSessionId?: SessionId; signal?: AbortSignal } = {},
  ): Promise<void> => {
    if (switchingConversation) {
      throw new Error('Another Agent change is already in progress.');
    }
    if (
      active.projector.getSnapshot().busy ||
      approvalRuntime.getSnapshot().pending.length > 0 ||
      userQuestionRuntime.getSnapshot().pending.length > 0 ||
      permissionSelectionRuntime.getSnapshot().busy
    ) {
      throw new Error(
        'Cannot switch the active conversation while the current Session is busy.',
      );
    }
    switchingConversation = true;
    try {
      const next = await createActiveConversation(selected, options);
      const previous = active;
      try {
        const flushed = await sessions.flush(previous.handle.agent.session);
        if (!flushed)
          throw new Error('DSH Session persistence is unavailable.');
      } catch (error) {
        next.offSession();
        next.offProjector();
        try {
          await next.handle.dispose();
        } catch (disposeError) {
          debugLogger.debug(
            `Unable to dispose an uncommitted DSH Agent candidate: ${String(disposeError)}`,
          );
        }
        throw error;
      }
      previous.offSession();
      previous.offProjector();
      active = next;
      activeSelection = selected;
      commandRuntime.activeAgentChanged();
      permissionSelectionRuntime.activeAgentChanged();
      toolCatalogRuntime.activeAgentChanged();
      notifyRuntime();
      try {
        await previous.handle.dispose();
      } catch (error) {
        debugLogger.debug(
          `Unable to dispose the previous DSH Agent: ${String(error)}`,
        );
      }
    } finally {
      switchingConversation = false;
    }
  };
  const modelSelectionRuntime = await DshModelSelectionRuntime.create(
    llm,
    defaultModel,
    switchActiveConversation,
    () => active.projector.getSnapshot().messages.length > 0,
  );
  const sessionManagementRuntime = new DshSessionManagementRuntime(
    sessionQuery,
    llm,
    process.cwd(),
    String(active.handle.agent.session.id),
    {
      currentSelection: () => modelSelectionRuntime.getSnapshot().current,
      createFresh: async (selected, signal) => {
        await switchActiveConversation(selected, { signal });
        return String(active.handle.agent.session.id);
      },
      resume: async (sessionId, selected, signal) => {
        await switchActiveConversation(selected, {
          resumeSessionId: sessionId,
          signal,
        });
        return String(active.handle.agent.session.id);
      },
      adoptCurrentModel: (selected) =>
        modelSelectionRuntime.adoptCurrent(selected),
      hasConversation: () => active.projector.getSnapshot().messages.length > 0,
      isBusy: isConversationBusy,
    },
  );
  let disposed = false;
  let exiting = false;
  const cleanup = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    active.offSession();
    active.offProjector();
    await Promise.all([
      active.handle.dispose(),
      promptCompletionRuntime.dispose(),
      promptInputRuntime.dispose(),
      Promise.resolve(approvalRuntime.dispose()),
      Promise.resolve(userQuestionRuntime.dispose()),
      Promise.resolve(commandRuntime.dispose()),
      Promise.resolve(permissionSelectionRuntime.dispose()),
      Promise.resolve(toolCatalogRuntime.dispose()),
    ]);
  };
  const submit = async ({
    content,
    displayContent,
    signal,
  }: ConversationSubmission): Promise<void> => {
    const conversation = active;
    if (conversation.projector.getSnapshot().busy) return;
    if (content.some((part) => part.type === 'image-source')) {
      await modelSelectionRuntime.assertCurrentSupportsImages(signal);
    }
    const ingested = await attachmentInput.ingest(
      content,
      displayContent,
      signal,
    );
    signal.throwIfAborted();
    conversation.projector.addUser(
      projectDshContent(ingested.content),
      projectDshContent(ingested.displayContent),
    );
    try {
      conversation.handle.agent.followup(
        createUserMessage({
          content: [...ingested.content],
          source: { kind: 'user' },
        }),
      );
      await Promise.all(
        ingested.clipboardFiles.map(async (file) => {
          try {
            await unlink(file);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              debugLogger.debug(
                `Unable to remove ingested clipboard image ${file}: ${String(error)}`,
              );
            }
          }
        }),
      );
    } catch (error) {
      conversation.projector.fail(error);
    }
  };

  const exit = (): void => {
    if (exiting) return;
    exiting = true;
    const forceExit = setTimeout(() => process.exit(0), FORCE_EXIT_TIMEOUT_MS);
    forceExit.unref();
    const cleanupTimeout = new Promise<void>((resolve) => {
      setTimeout(resolve, CLEANUP_TIMEOUT_MS);
    });
    void Promise.race([runExitCleanup(), cleanupTimeout])
      .then(cleanup)
      .finally(() => appExit(0));
  };

  const conversationRuntime: ConversationRuntime = {
    getSnapshot: () => active.projector.getSnapshot(),
    getSessionStats: () => active.projector.getSessionStats(),
    subscribe: (listener) => {
      runtimeListeners.add(listener);
      return () => runtimeListeners.delete(listener);
    },
    submit,
    cancel: () => {
      active.handle.agent.cancel({ kind: 'user' });
      active.projector.cancel();
    },
    exit,
  };
  ctx.effect(() => cleanup, 'dsh-console: terminal');
  await main({
    conversationRuntime,
    promptCompletionRuntime,
    promptInputRuntime,
    modelSelectionRuntime,
    sessionManagementRuntime,
    approvalRuntime,
    userQuestionRuntime,
    commandRuntime,
    permissionSelectionRuntime,
    toolCatalogRuntime,
    initialPrompt: config.prompt?.trim(),
    argv: config.debug ? ['--debug'] : [],
  });
}

export function apply(ctx: Context, config: Config): void {
  const appExit = ctx.get('appExit');
  void start(ctx, config).catch(async (error: unknown) => {
    const forceExit = setTimeout(() => process.exit(1), FORCE_EXIT_TIMEOUT_MS);
    try {
      await runExitCleanup();
    } finally {
      process.stderr.write(
        `dsh-console: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      appExit?.(1);
      if (!appExit) {
        clearTimeout(forceExit);
        process.exit(1);
      }
    }
  });
}
