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
  type Agent,
  type AgentHandle,
  type ModelSelection,
  type ModelSelectionRef,
} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-agent-default-model';
import type {} from '@deepseek-ai/cordis-plugin-loader';
import type {} from '@deepseek-ai/dsh-cmdline';
import type {} from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-tool-todo';
import type {} from '@deepseek-ai/dsh-attachment';
import type {} from '@deepseek-ai/dsh-session-query';
import type {} from '@deepseek-ai/dsh-user-approval';
import type {} from '@deepseek-ai/dsh-user-questions';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from '@deepseek-ai/dsh-session-projection';
import type {} from '@deepseek-ai/dsh-permission-presets';
import type {} from '@deepseek-ai/dsh-credentials';
import type {} from '@deepseek-ai/dsh-settings';
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
import {
  completedTurnSeed,
  firstSidePrompt,
  pendingUserText,
  SIDE_SESSION_PREFIX,
} from './side-conversation.js';
import {
  ConversationWorkspaceRuntime,
  type SideConversationHandle,
} from '../ui/conversation-workspace-runtime.js';
import {
  modelReasoningEffortLabel,
  modelSelectionLabel,
} from '../ui/model-selection-runtime.js';
import { WorkspacePromptInputRuntime } from './prompt-input-runtime.js';
import { DshToolPresentationAdapter } from './tool-presenter.js';
import { DshAttachmentInputAdapter } from './attachment-input-adapter.js';
import { projectDshContent } from './content-projector.js';
import { debugLogger } from '@cofy-x/dsh-console-core';
import { unlink } from 'node:fs/promises';
import { DshModelSelectionRuntime } from './model-selection-runtime.js';
import { DshSessionManagementRuntime } from './session-management-runtime.js';
import { DshApprovalRuntime } from './approval-runtime.js';
import {
  createUserQuestionAnswererRegistration,
  DshUserQuestionRuntime,
  type UserQuestionEventListener,
} from './user-question-runtime.js';
import { DshCommandRuntimeAdapter } from './command-runtime.js';
import { DshToolCatalogRuntime } from './tool-catalog-runtime.js';
import { DshPermissionSelectionRuntime } from './permission-selection-runtime.js';
import { DshProviderSetupRuntime } from './provider-setup-runtime.js';
import { DshSubagentCatalogRuntime } from './subagent-catalog-runtime.js';

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
  'credentials',
  'settings',
  'subagents',
];

export interface Config {
  prompt?: string;
  debug?: boolean;
  pokemon?: number;
}

export const Config: z<Config> = z.object({
  prompt: z.string(),
  debug: z.boolean().default(false),
  pokemon: z.number(),
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
  const credentials = ctx.get('credentials');
  const settings = ctx.get('settings');
  const subagents = ctx.get('subagents');
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
  if (!credentials)
    throw new Error('dsh-console requires the DSH credentials service');
  if (!settings)
    throw new Error('dsh-console requires the DSH settings service');
  if (!subagents)
    throw new Error('dsh-console requires the DSH subagent service');
  if (!agents || !defaultModel || !sessions || !tools || !llm || !appExit)
    return;

  const selection = defaultModel.currentSelection();
  let activeSelection: ModelSelection = selection;
  let sideSelection: ModelSelection | undefined;
  const workspaceRef: { current?: ConversationWorkspaceRuntime } = {};
  const runtimeListeners = new Set<() => void>();
  const notifyRuntime = (): void => {
    for (const listener of runtimeListeners) listener();
  };
  const promptCompletionRuntime = new DshPromptCompletionRuntime(
    {
      createAgent: (options) => agents.create(options),
      onSessionEvent: (listener) => ctx.on('session/event', listener),
    },
    () =>
      workspaceRef.current?.getWorkspaceSnapshot().activeSurface === 'side'
        ? (sideSelection ?? activeSelection)
        : activeSelection,
  );
  const promptInputRuntime = new WorkspacePromptInputRuntime();
  const attachmentInput = new DshAttachmentInputAdapter(attachments);

  const createActiveConversation = async (
    selected: ModelSelection,
    options: {
      resumeSessionId?: SessionId;
      signal?: AbortSignal;
      sessionId?: SessionId;
      parentSession?: SessionId;
      seed?: readonly SessionEvent[];
      restrictTools?: boolean;
      publishRuntimeEvents?: boolean;
    } = {},
  ) => {
    const modelInfo = await llm.resolveModelInfo(
      selected.provider,
      selected.model,
      options.signal,
    );
    options.signal?.throwIfAborted();
    const agentOptions = {
      provider: selected.provider,
      model: selected.model,
      ...(selected.reasoningEffort === undefined
        ? {}
        : { reasoningEffort: selected.reasoningEffort }),
    };
    const setup = (agentCtx: Context) => {
      const ref: ModelSelectionRef = {
        current: selected,
        assembled: undefined,
      };
      installModelSelection(agentCtx, ref);
      if (options.restrictTools) agentCtx.tools.restrict({ allow: [] });
    };
    const handle: AgentHandle =
      options.resumeSessionId === undefined
        ? await agents.create({
            sessionId:
              options.sessionId ?? SessionId(`dsh-console-${randomUUID()}`),
            meta: {
              cwd: process.cwd(),
              ...(options.parentSession === undefined
                ? {}
                : { parentSession: options.parentSession }),
              ...(options.seed === undefined
                ? {}
                : { seedLength: options.seed.length }),
            },
            ...(options.seed === undefined ? {} : { seed: options.seed }),
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
        modelInfo.context?.contextWindow,
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
      const offProjector =
        options.publishRuntimeEvents === false
          ? () => {}
          : projector.subscribe(notifyRuntime);
      return {
        kind: 'materialized' as const,
        handle,
        projector,
        offSession,
        offProjector,
      };
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

  const createPendingConversation = async (
    selected: ModelSelection,
    signal?: AbortSignal,
  ) => {
    const modelInfo = await llm.resolveModelInfo(
      selected.provider,
      selected.model,
      signal,
    );
    signal?.throwIfAborted();
    const projector = new DshSessionProjector(
      `dsh-console-pending-${randomUUID()}`,
      String(selected.model),
      new DshToolPresentationAdapter(tools),
      modelInfo.context?.contextWindow,
    );
    return {
      kind: 'pending' as const,
      projector,
      offProjector: projector.subscribe(notifyRuntime),
    };
  };
  type ActiveConversation =
    | Awaited<ReturnType<typeof createActiveConversation>>
    | Awaited<ReturnType<typeof createPendingConversation>>;

  let active: ActiveConversation = await createPendingConversation(selection);
  let visibleSideAgent: Agent | undefined;
  const mainAgent = (): Agent | undefined =>
    active.kind === 'materialized' ? active.handle.agent : undefined;
  const currentInteractiveAgent = (): Agent | undefined =>
    workspaceRef.current?.getWorkspaceSnapshot().activeSurface === 'side' &&
    visibleSideAgent
      ? visibleSideAgent
      : mainAgent();
  const providerSetupRuntime = await DshProviderSetupRuntime.create(
    credentials,
    settings,
    llm,
    () => activeSelection.provider,
  );
  const approvalRuntime = new DshApprovalRuntime(
    (listener) => ctx.on('approval/request', listener),
    (agent) => agent === mainAgent(),
  );
  const onUserQuestion = ctx.on as unknown as (
      event: 'user-questions/request',
      listener: UserQuestionEventListener,
    ) => () => void;
  const ownsMainAgent = (agent: Agent) => agent === mainAgent();
  const registerUserQuestionAnswerer =
    createUserQuestionAnswererRegistration(
      userQuestions,
      (listener) => onUserQuestion('user-questions/request', listener),
      ownsMainAgent,
    );
  const userQuestionRuntime = new DshUserQuestionRuntime(
    registerUserQuestionAnswerer,
    ownsMainAgent,
  );
  const commandRuntime = new DshCommandRuntimeAdapter(
    commands,
    currentInteractiveAgent,
    (listener) => ctx.on('commands/change', listener),
  );
  const permissionSelectionRuntime = new DshPermissionSelectionRuntime(
    sessionProjections,
    commandRuntime,
    currentInteractiveAgent,
  );
  const toolCatalogRuntime = new DshToolCatalogRuntime(
    tools,
    currentInteractiveAgent,
    (listener) => ctx.on('tools/change', listener),
  );
  const subagentCatalogRuntime = new DshSubagentCatalogRuntime(
    subagents,
    () => mainAgent()?.session.id,
    (listener) => {
      const offStart = ctx.on('subagent/start', () => listener());
      const offEnd = ctx.on('subagent/end', () => listener());
      const offDescriptor = ctx.on('session/event', (_session, event) => {
        if (event.type === 'subagent/descriptor') listener();
      });
      return () => {
        offStart();
        offEnd();
        offDescriptor();
      };
    },
    sessionQuery,
    new DshToolPresentationAdapter(tools),
    (sessionId, listener) =>
      ctx.on('session/event', (session, event) => {
        if (session.id === sessionId) listener(event);
      }),
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
      const next = options.resumeSessionId === undefined
        ? await createPendingConversation(selected, options.signal)
        : await createActiveConversation(selected, options);
      const previous = active;
      if (previous.kind === 'materialized') {
        try {
          const flushed = await sessions.flush(previous.handle.agent.session);
          if (!flushed)
            throw new Error('DSH Session persistence is unavailable.');
        } catch (error) {
          next.offProjector();
          if (next.kind === 'materialized') {
            next.offSession();
            try {
              await next.handle.dispose();
            } catch (disposeError) {
              debugLogger.debug(
                `Unable to dispose an uncommitted DSH Agent candidate: ${String(disposeError)}`,
              );
            }
          }
          throw error;
        }
      }
      previous.offProjector();
      if (previous.kind === 'materialized') previous.offSession();
      active = next;
      activeSelection = selected;
      await providerSetupRuntime.refreshCurrent();
      commandRuntime.activeAgentChanged();
      permissionSelectionRuntime.activeAgentChanged();
      toolCatalogRuntime.activeAgentChanged();
      subagentCatalogRuntime.activeAgentChanged();
      notifyRuntime();
      if (previous.kind === 'materialized') {
        try {
          await previous.handle.dispose();
        } catch (error) {
          debugLogger.debug(
            `Unable to dispose the previous DSH Agent: ${String(error)}`,
          );
        }
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
    active.projector.getSessionStats().sessionId,
    {
      currentSelection: () => modelSelectionRuntime.getSnapshot().current,
      createFresh: async (selected, signal) => {
        await switchActiveConversation(selected, { signal });
        return active.projector.getSessionStats().sessionId;
      },
      resume: async (sessionId, selected, signal) => {
        await switchActiveConversation(selected, {
          resumeSessionId: sessionId,
          signal,
        });
        return active.projector.getSessionStats().sessionId;
      },
      adoptCurrentModel: (selected) =>
        modelSelectionRuntime.adoptCurrent(selected),
      hasConversation: () => active.projector.getSnapshot().messages.length > 0,
      isBusy: isConversationBusy,
    },
  );
  let disposed = false;
  let exiting = false;
  let offWorkspaceSurface = () => {};
  const cleanup = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    offWorkspaceSurface();
    active.offProjector();
    if (active.kind === 'materialized') active.offSession();
    await Promise.all([
      active.kind === 'materialized' ? active.handle.dispose() : Promise.resolve(),
      promptCompletionRuntime.dispose(),
      workspaceRef.current?.dispose(),
      promptInputRuntime.dispose(),
      Promise.resolve(approvalRuntime.dispose()),
      Promise.resolve(userQuestionRuntime.dispose()),
      Promise.resolve(commandRuntime.dispose()),
      Promise.resolve(permissionSelectionRuntime.dispose()),
      Promise.resolve(toolCatalogRuntime.dispose()),
      Promise.resolve(subagentCatalogRuntime.dispose()),
    ]);
  };
  const materializeActiveConversation = async (
    signal: AbortSignal,
  ): Promise<Awaited<ReturnType<typeof createActiveConversation>>> => {
    if (active.kind === 'materialized') return active;
    if (switchingConversation) {
      throw new Error('Another Agent change is already in progress.');
    }
    switchingConversation = true;
    const previous = active;
    let next: Awaited<ReturnType<typeof createActiveConversation>> | undefined;
    try {
      next = await createActiveConversation(activeSelection, { signal });
      signal.throwIfAborted();
      previous.offProjector();
      active = next;
      commandRuntime.activeAgentChanged();
      permissionSelectionRuntime.activeAgentChanged();
      toolCatalogRuntime.activeAgentChanged();
      subagentCatalogRuntime.activeAgentChanged();
      notifyRuntime();
      return next;
    } catch (error) {
      if (next !== undefined && active !== next) {
        next.offSession();
        next.offProjector();
        await next.handle.dispose().catch((disposeError: unknown) => {
          debugLogger.debug(
            `Unable to dispose an aborted DSH Agent candidate: ${String(disposeError)}`,
          );
        });
      }
      throw error;
    } finally {
      switchingConversation = false;
    }
  };
  type IngestedSubmission = Awaited<ReturnType<typeof attachmentInput.ingest>>;
  const prepareSubmission = async (
    { content, displayContent, signal }: ConversationSubmission,
    allowImages: boolean,
  ): Promise<IngestedSubmission> => {
    if (content.some((part) => part.type === 'image-source')) {
      if (!allowImages) {
        throw new Error(
          'Side conversations currently support text input only.',
        );
      }
      await modelSelectionRuntime.assertCurrentSupportsImages(signal);
    }
    return attachmentInput.ingest(content, displayContent, signal);
  };
  const submitToConversation = async (
    conversation: Awaited<ReturnType<typeof createActiveConversation>>,
    ingested: IngestedSubmission,
    signal: AbortSignal,
  ): Promise<void> => {
    if (conversation.projector.getSnapshot().busy) return;
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

  const mainConversationRuntime: ConversationRuntime = {
    getSnapshot: () => active.projector.getSnapshot(),
    getSessionStats: () => active.projector.getSessionStats(),
    subscribe: (listener) => {
      runtimeListeners.add(listener);
      return () => runtimeListeners.delete(listener);
    },
    submit: async (submission) => {
      const ingested = await prepareSubmission(submission, true);
      const conversation = await materializeActiveConversation(submission.signal);
      await submitToConversation(conversation, ingested, submission.signal);
    },
    cancel: () => {
      if (active.kind === 'materialized') {
        active.handle.agent.cancel({ kind: 'user' });
        active.projector.cancel();
      }
    },
    exit,
  };
  const conversationWorkspace = new ConversationWorkspaceRuntime(
    mainConversationRuntime,
    async (signal): Promise<SideConversationHandle> => {
      if (active.kind !== 'materialized') {
        throw new Error('Start the main conversation before opening a Side conversation.');
      }
      const parent = active.handle.agent;
      const parentEvents = parent.session.events;
      const seed = completedTurnSeed(parentEvents);
      const pendingRequest = pendingUserText(parentEvents, seed.length);
      const selected = activeSelection;
      const selectedView = modelSelectionRuntime.getSnapshot().current;
      const side = await createActiveConversation(selected, {
        signal,
        sessionId: SessionId(`${SIDE_SESSION_PREFIX}${randomUUID()}`),
        parentSession: parent.session.id,
        seed,
        restrictTools: true,
        publishRuntimeEvents: false,
      });
      sideSelection = selected;
      visibleSideAgent = side.handle.agent;
      let firstSubmission = true;
      let sideDisposed = false;
      const handle: SideConversationHandle = {
        parentSessionId: String(parent.session.id),
        modelLabel: modelSelectionLabel(selectedView),
        ...(modelReasoningEffortLabel(selectedView) === undefined
          ? {}
          : {
              reasoningEffortLabel: modelReasoningEffortLabel(selectedView),
            }),
        getSnapshot: side.projector.getSnapshot,
        getSessionStats: side.projector.getSessionStats,
        subscribe: side.projector.subscribe,
        submit: async (submission) => {
          let prefixedFirstText = false;
          const prepared = firstSubmission
            ? {
                ...submission,
                content: submission.content.map((part) => {
                  if (prefixedFirstText || part.type !== 'text') return part;
                  prefixedFirstText = true;
                  return {
                    ...part,
                    text: firstSidePrompt(part.text, pendingRequest),
                  };
                }),
              }
            : submission;
          const ingested = await prepareSubmission(prepared, false);
          await submitToConversation(side, ingested, prepared.signal);
          firstSubmission = false;
        },
        cancel: () => {
          side.handle.agent.cancel({ kind: 'user' });
          side.projector.cancel();
        },
        exit: () => {},
        dispose: async () => {
          if (sideDisposed) return;
          sideDisposed = true;
          if (side.projector.getSnapshot().busy) {
            side.handle.agent.cancel({ kind: 'user' });
            await side.handle.agent.whenIdle();
          }
          await sessions
            .flush(side.handle.agent.session)
            .catch((error: unknown) => {
              debugLogger.debug(
                `Unable to flush Side Session: ${String(error)}`,
              );
            });
          side.offSession();
          side.offProjector();
          await side.handle.dispose();
          if (visibleSideAgent === side.handle.agent)
            visibleSideAgent = undefined;
          if (sideSelection === selected) sideSelection = undefined;
        },
      };
      return handle;
    },
  );
  workspaceRef.current = conversationWorkspace;
  offWorkspaceSurface = conversationWorkspace.subscribeSurface(() => {
    commandRuntime.activeAgentChanged();
    permissionSelectionRuntime.activeAgentChanged();
    toolCatalogRuntime.activeAgentChanged();
  });
  ctx.effect(() => cleanup, 'dsh-console: terminal');
  await main({
    conversationRuntime: conversationWorkspace,
    promptCompletionRuntime,
    promptInputRuntime,
    modelSelectionRuntime,
    providerSetupRuntime,
    sessionManagementRuntime,
    approvalRuntime,
    userQuestionRuntime,
    commandRuntime,
    permissionSelectionRuntime,
    toolCatalogRuntime,
    subagentCatalogRuntime,
    sideConversationRuntime: conversationWorkspace,
    initialPrompt: config.prompt?.trim(),
    argv: [
      ...(config.debug ? ['--debug'] : []),
      ...(config.pokemon === undefined
        ? []
        : ['--pokemon', String(config.pokemon)]),
    ],
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
