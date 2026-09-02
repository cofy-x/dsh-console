/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  foldSurface,
  isSurfaceEvent,
  type SessionEvent,
} from '@deepseek-ai/dsh-session';
import type { TokenUsage } from '@deepseek-ai/dsh-llm';
import type { ToolResult } from '@deepseek-ai/dsh-tools';
import {
  createInitialModelMetrics,
  createInitialSessionMetrics,
  createInitialToolCallStats,
  type SessionMetrics,
} from '../ui/session-metrics.js';
import type {
  ConversationContentBlock,
  ConversationContentMessage,
  ConversationMessage,
  ConversationSessionStats,
  ConversationSnapshot,
  ConversationToolMessage,
  ConversationToolResult,
  ConversationToolPresentation,
} from '../ui/conversation-runtime.js';
import { projectDshContent } from './content-projector.js';
import { SessionTimingProjector } from './session-timing-projector.js';

type Listener = () => void;

export interface DshToolPresenter {
  presentCall(
    name: string,
    argumentsJson: string,
  ): ConversationToolPresentation | undefined;
  presentResult(
    name: string,
    argumentsJson: string,
    result: ToolResult,
  ): ConversationToolPresentation | undefined;
}

function mergeToolPresentation(
  existing: ConversationToolPresentation | undefined,
  next: ConversationToolPresentation | undefined,
): ConversationToolPresentation | undefined {
  if (next === undefined) return existing;
  if (existing === undefined || existing.kind !== next.kind) return next;
  if (next.kind === 'compact' || existing.kind === 'compact') return next;
  return { ...existing, ...next };
}

export class DshSessionProjector {
  private snapshot: ConversationSnapshot = {
    messages: [],
    todos: [],
    busy: false,
  };
  private readonly listeners = new Set<Listener>();
  private nextMessage = 0;
  private activeTurn: number | undefined;
  private readonly cancelledTurns = new Set<number>();
  private readonly pendingUserIds: string[] = [];
  private readonly assistantStreams = new Map<
    string,
    Map<number, ConversationContentBlock>
  >();
  private readonly accountedUsages = new Set<string>();
  private readonly metrics: SessionMetrics = createInitialSessionMetrics();
  private readonly timingProjector = new SessionTimingProjector();
  private readonly toolNames = new Map<string, string>();
  private lastPromptTokenCount = 0;

  constructor(
    private readonly sessionId = 'dsh-console',
    private readonly model = 'default',
    private readonly toolPresenter?: DshToolPresenter,
    private readonly contextWindow?: number,
  ) {}

  getSnapshot = (): ConversationSnapshot => this.snapshot;

  getSessionStats = (): ConversationSessionStats => ({
    sessionId: this.sessionId,
    metrics: this.metrics,
    timing: this.timingProjector.metrics,
    lastPromptTokenCount: this.lastPromptTokenCount,
    ...(this.contextWindow === undefined
      ? {}
      : { contextWindow: this.contextWindow }),
  });

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  replay(events: readonly SessionEvent[]): void {
    const currentSurface = new Set(foldSurface(events).nodes);
    for (const event of events) {
      if (event.type === 'assistant/chunk') {
        this.timingProjector.project(event);
        continue;
      }
      if (isSurfaceEvent(event) && !currentSurface.has(event.seq)) continue;
      this.project(event);
    }
    this.pendingUserIds.length = 0;
  }

  addUser(
    content: readonly ConversationContentBlock[],
    displayContent: readonly ConversationContentBlock[] = content,
  ): void {
    const id = `user-${this.nextMessage++}`;
    this.pendingUserIds.push(id);
    this.append({ id, role: 'user', content, displayContent });
    this.update({ busy: true });
  }

  fail(error: unknown): void {
    this.pendingUserIds.pop();
    this.append({
      id: `system-${this.nextMessage++}`,
      role: 'system',
      content: [
        {
          type: 'text',
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      status: 'error',
    });
    this.update({ busy: false });
  }

  cancel(): void {
    if (!this.snapshot.busy) return;
    if (this.activeTurn !== undefined) {
      this.cancelledTurns.add(this.activeTurn);
      this.clearAssistantStreams(this.activeTurn);
    }
    this.pendingUserIds.pop();
    this.append({
      id: `system-${this.nextMessage++}`,
      role: 'system',
      content: [{ type: 'text', text: 'Request cancelled.' }],
      status: 'cancelled',
    });
    this.update({ busy: false });
  }

  project(event: SessionEvent): void {
    const completedTurn = this.timingProjector.project(event);
    if (completedTurn !== undefined) {
      this.snapshot = {
        ...this.snapshot,
        messages: this.snapshot.messages.map((message) =>
          message.id === completedTurn.messageId && message.role === 'assistant'
            ? { ...message, turnMetrics: completedTurn.metrics }
            : message,
        ),
      };
    }
    if (event.type === 'turn/start') {
      this.activeTurn = event.data.turn;
      this.update({ busy: true });
      return;
    }
    if (event.type === 'user/message') {
      if (event.data.source.kind !== 'user') return;
      const content = projectDshContent(event.data.content);
      const pendingId = this.pendingUserIds.shift();
      if (pendingId === undefined) {
        this.append({
          id: String(event.data.id),
          role: 'user',
          content,
        });
      } else {
        this.updateContentMessage(pendingId, { content });
      }
      return;
    }
    if (
      event.type === 'assistant/chunk' &&
      (event.data.chunk.type === 'text-delta' ||
        event.data.chunk.type === 'reasoning-delta')
    ) {
      if (this.cancelledTurns.has(event.data.turn)) return;
      const chunk = event.data.chunk;
      const id = this.assistantId(event.data.turn, event.data.step);
      this.upsertAssistantDelta(
        id,
        chunk.index,
        chunk.type === 'text-delta' ? 'text' : 'reasoning',
        chunk.text,
      );
      return;
    }
    if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
      if (this.cancelledTurns.has(event.data.turn)) return;
      this.accountUsage(
        event.data.turn,
        event.data.step,
        event.data.chunk.usage,
      );
      return;
    }
    if (event.type === 'assistant/message') {
      if (this.cancelledTurns.has(event.data.turn)) return;
      if (event.data.usage !== undefined) {
        this.accountUsage(event.data.turn, event.data.step, event.data.usage);
      }
      const id = this.assistantId(event.data.turn, event.data.step);
      this.assistantStreams.delete(id);
      this.upsertAssistant(id, {
        content: projectDshContent(event.data.message.content),
        ...(event.data.interrupted === true ? { interrupted: true } : {}),
      });
      return;
    }
    if (event.type === 'tool/call') {
      if (this.cancelledTurns.has(event.data.turn)) return;
      const callId = String(event.data.callId);
      this.toolNames.set(callId, event.data.name);
      const tool = (this.metrics.tools.byName[event.data.name] ??=
        createInitialToolCallStats());
      tool.count += 1;
      this.metrics.tools.totalCalls += 1;
      this.append({
        id: `tool-${String(event.data.callId)}`,
        role: 'tool',
        callId: String(event.data.callId),
        name: event.data.name,
        arguments: event.data.arguments,
        status: 'executing',
        presentation: this.toolPresenter?.presentCall(
          event.data.name,
          event.data.arguments,
        ),
      });
      return;
    }
    if (event.type === 'tool/result') {
      if (this.cancelledTurns.has(event.data.turn)) return;
      const callId = String(event.data.message.source.callId);
      const id = `tool-${callId}`;
      const resultBlock = event.data.message.content.find(
        (block) => block.type === 'tool-result',
      );
      const failed =
        resultBlock?.isError === true || event.data.error !== undefined;
      const result: ConversationToolResult = {
        content: projectDshContent(resultBlock?.content ?? []),
        isError: failed,
        ...(event.data.error === undefined ? {} : { error: event.data.error }),
        ...(event.data.meta === undefined ? {} : { meta: event.data.meta }),
      };
      const existingMessage = this.snapshot.messages.find(
        (message): message is ConversationToolMessage =>
          message.id === id && message.role === 'tool',
      );
      const toolName = this.toolNames.get(callId) ?? 'tool';
      const tool = (this.metrics.tools.byName[toolName] ??=
        createInitialToolCallStats());
      if (failed) {
        tool.fail += 1;
        this.metrics.tools.totalFail += 1;
      } else {
        tool.success += 1;
        this.metrics.tools.totalSuccess += 1;
      }
      this.toolNames.delete(callId);
      const resultPresentation = this.toolPresenter?.presentResult(
        toolName,
        existingMessage?.arguments ?? '',
        {
          content: resultBlock?.content ?? [],
          isError: failed,
          ...(event.data.meta === undefined ? {} : { meta: event.data.meta }),
        },
      );
      const presentation = mergeToolPresentation(
        existingMessage?.presentation,
        resultPresentation,
      );
      this.upsertTool(id, {
        callId,
        status: failed ? 'error' : 'success',
        result,
        ...(presentation === undefined ? {} : { presentation }),
      });
      return;
    }
    if (event.type === 'todo/write') {
      this.update({
        todos: event.data.todos.map((todo) => ({ ...todo })),
      });
      return;
    }
    if (event.type === 'turn/end') {
      this.cancelledTurns.delete(event.data.turn);
      this.clearAssistantStreams(event.data.turn);
      this.pendingUserIds.length = 0;
      this.activeTurn = undefined;
      if (event.data.reason.kind === 'error') {
        this.append({
          id: `system-${this.nextMessage++}`,
          role: 'system',
          content: [
            {
              type: 'text',
              text: `${event.data.reason.error.code}: ${event.data.reason.error.message}`,
            },
          ],
          status: 'error',
        });
      }
      this.update({ busy: false });
    }
  }

  private assistantId(turn: number, step: number): string {
    return `assistant-${String(turn)}-${String(step)}`;
  }

  private accountUsage(turn: number, step: number, usage: TokenUsage): void {
    const key = `${String(turn)}:${String(step)}`;
    if (this.accountedUsages.has(key)) return;
    this.accountedUsages.add(key);
    const cacheRead = usage.cacheReadTokens ?? 0;
    const cacheWrite = usage.cacheWriteTokens ?? 0;
    const prompt = usage.inputTokens + cacheRead + cacheWrite;
    const model = (this.metrics.models[this.model] ??=
      createInitialModelMetrics());
    model.requests += 1;
    model.tokens.inputTokens += usage.inputTokens;
    model.tokens.outputTokens += usage.outputTokens;
    model.tokens.cacheReadTokens += cacheRead;
    model.tokens.cacheWriteTokens += cacheWrite;
    model.tokens.reasoningTokens += usage.reasoningTokens ?? 0;
    model.tokens.totalTokens += prompt + usage.outputTokens;
    this.lastPromptTokenCount = prompt;
    this.emit();
  }

  private clearAssistantStreams(turn: number): void {
    const prefix = `assistant-${String(turn)}-`;
    for (const id of this.assistantStreams.keys()) {
      if (id.startsWith(prefix)) this.assistantStreams.delete(id);
    }
  }

  private upsertAssistantDelta(
    id: string,
    index: number,
    type: 'text' | 'reasoning',
    text: string,
  ): void {
    const stream = this.assistantStreams.get(id) ?? new Map();
    const current = stream.get(index);
    stream.set(index, {
      type,
      text: current?.type === type ? current.text + text : text,
    });
    this.assistantStreams.set(id, stream);
    this.upsertAssistant(id, {
      content: [...stream.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, block]) => block),
    });
  }

  private upsertAssistant(
    id: string,
    update: Pick<ConversationContentMessage, 'content'> &
      Partial<Pick<ConversationContentMessage, 'interrupted'>>,
  ): void {
    const existing = this.snapshot.messages.find(
      (message) => message.id === id && message.role === 'assistant',
    );
    if (existing === undefined) {
      this.append({ id, role: 'assistant', ...update });
      return;
    }
    this.updateContentMessage(id, update);
  }

  private updateContentMessage(
    id: string,
    update: Partial<ConversationContentMessage>,
  ): void {
    this.snapshot = {
      ...this.snapshot,
      messages: this.snapshot.messages.map((message) =>
        message.id === id && message.role !== 'tool'
          ? { ...message, ...update }
          : message,
      ),
    };
    this.emit();
  }

  private upsertTool(
    id: string,
    update: Pick<ConversationToolMessage, 'callId' | 'status'> &
      Partial<Pick<ConversationToolMessage, 'result' | 'presentation'>>,
  ): void {
    const existing = this.snapshot.messages.find(
      (message) => message.id === id,
    );
    if (existing?.role === 'tool') {
      this.snapshot = {
        ...this.snapshot,
        messages: this.snapshot.messages.map((message) =>
          message.id === id && message.role === 'tool'
            ? { ...message, ...update }
            : message,
        ),
      };
      this.emit();
      return;
    }
    this.append({
      id,
      role: 'tool',
      callId: update.callId,
      name: 'tool',
      arguments: '',
      status: update.status,
      ...(update.result === undefined ? {} : { result: update.result }),
    });
  }

  private append(message: ConversationMessage): void {
    this.snapshot = {
      ...this.snapshot,
      messages: [...this.snapshot.messages, message],
    };
    this.emit();
  }

  private update(update: Partial<ConversationSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...update };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
