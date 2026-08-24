/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { DshSessionProjector } from './projector.js';

const event = (value: unknown): SessionEvent => value as SessionEvent;

describe('DshSessionProjector replay', () => {
  it('replays the canonical surface without raw chunk duplication', () => {
    const projector = new DshSessionProjector();
    projector.replay([
      event({
        seq: 0,
        time: 1,
        type: 'user/message',
        surfaceOp: 'append',
        data: {
          id: 'user-1',
          role: 'user',
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'hello' }],
        },
      }),
      event({
        seq: 1,
        time: 2,
        type: 'assistant/chunk',
        data: { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'hel' } },
      }),
      event({
        seq: 2,
        time: 3,
        type: 'assistant/message',
        surfaceOp: 'append',
        data: {
          turn: 1,
          step: 1,
          message: { content: [{ type: 'text', text: 'hello back' }] },
        },
      }),
    ]);
    expect(projector.getSnapshot().messages).toEqual([
      {
        id: 'user-1',
        role: 'user',
        content: [{ type: 'text', text: 'hello' }],
      },
      {
        id: 'assistant-1-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'hello back' }],
      },
    ]);
  });

  it('projects only the surviving canonical surface node after replacement', () => {
    const projector = new DshSessionProjector();
    projector.replay([
      event({
        seq: 0,
        time: 1,
        type: 'assistant/message',
        surfaceOp: 'append',
        data: { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'old' }] } },
      }),
      event({
        seq: 1,
        time: 2,
        type: 'assistant/message',
        surfaceOp: { op: 'replace', start: 0, end: 0 },
        sourceEventSeqs: [0],
        data: { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'canonical' }] } },
      }),
    ]);
    expect(projector.getSnapshot().messages).toEqual([{
      id: 'assistant-1-1',
      role: 'assistant',
      content: [{ type: 'text', text: 'canonical' }],
    }]);
  });
});

describe('DshSessionProjector', () => {
  it('deduplicates streaming text against the final message', () => {
    const projector = new DshSessionProjector();
    projector.project(event({ type: 'turn/start', data: { turn: 1 } }));
    projector.project(event({ type: 'assistant/chunk', data: { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'hel' } } }));
    projector.project(event({ type: 'assistant/chunk', data: { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'lo' } } }));
    projector.project(event({ type: 'assistant/message', data: { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'hello' }] } } }));
    projector.project(event({ type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }));
    expect(projector.getSnapshot()).toEqual({
      busy: false,
      todos: [],
      messages: [{ id: 'assistant-1-1', role: 'assistant', content: [{ type: 'text', text: 'hello' }] }],
    });
  });

  it('keeps two user turns and reports a DSH error', () => {
    const projector = new DshSessionProjector();
    projector.addUser([{ type: 'text', text: 'one' }]);
    projector.project(event({ type: 'turn/start', data: { turn: 1 } }));
    projector.project(event({ type: 'assistant/message', data: { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'first' }] } } }));
    projector.project(event({ type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }));
    projector.addUser([{ type: 'text', text: 'two' }]);
    projector.project(event({ type: 'turn/start', data: { turn: 2 } }));
    projector.project(event({ type: 'turn/end', data: { turn: 2, reason: { kind: 'error', error: { code: 'boom', message: 'failed' } } } }));
    expect(
      projector.getSnapshot().messages.flatMap((message) =>
        message.role === 'tool'
          ? []
          : [message.content.map((block) => 'text' in block ? block.text : '').join('')],
      ),
    ).toEqual(['one', 'first', 'two', 'boom: failed']);
  });

  it('reconciles only human user messages and ignores injected context', () => {
    const projector = new DshSessionProjector();
    projector.addUser(
      [{ type: 'text', text: 'expanded README' }],
      [{ type: 'text', text: '@README.md' }],
    );
    projector.project(event({
      type: 'user/message',
      data: {
        id: 'injected',
        role: 'user',
        source: { kind: 'plugin', plugin: 'context' },
        content: [{ type: 'text', text: 'injected context' }],
      },
    }));
    projector.project(event({
      type: 'user/message',
      data: {
        id: 'canonical',
        role: 'user',
        source: { kind: 'user' },
        content: [{ type: 'text', text: 'expanded README' }],
      },
    }));
    expect(projector.getSnapshot().messages).toEqual([{
      id: 'user-0',
      role: 'user',
      content: [{ type: 'text', text: 'expanded README' }],
      displayContent: [{ type: 'text', text: '@README.md' }],
    }]);
  });

  it('reconciles canonical user image metadata without replacing display content', () => {
    const projector = new DshSessionProjector();
    projector.addUser(
      [{ type: 'image', attachment: { attachmentId: 'pending', mediaType: 'image/png', bytes: 1, width: 1, height: 1 } }],
      [{ type: 'text', text: '[Image screenshot.png]' }],
    );
    projector.project(event({
      type: 'user/message',
      data: {
        id: 'canonical-image',
        role: 'user',
        source: { kind: 'user' },
        content: [{
          type: 'image',
          attachment: {
            attachmentId: `sha256:${'a'.repeat(64)}`,
            mediaType: 'image/png',
            bytes: 42,
            width: 10,
            height: 20,
            name: 'screenshot.png',
          },
        }],
      },
    }));
    expect(projector.getSnapshot().messages[0]).toMatchObject({
      content: [{ type: 'image', attachment: { bytes: 42, width: 10, height: 20 } }],
      displayContent: [{ type: 'text', text: '[Image screenshot.png]' }],
    });
  });

  it('projects DSH tool calls and results into one display message', () => {
    const projector = new DshSessionProjector();
    projector.project(event({
      type: 'tool/call',
      data: { turn: 1, step: 1, callId: 'call-1', name: 'read_file', arguments: '{"path":"README.md"}' },
    }));
    projector.project(event({
      type: 'tool/result',
      data: {
        turn: 1,
        step: 1,
        message: {
          source: { kind: 'tool', callId: 'call-1' },
          content: [{ type: 'tool-result', callId: 'call-1', isError: false, content: [{ type: 'text', text: 'contents' }] }],
        },
      },
    }));
    expect(projector.getSnapshot().messages).toEqual([
      {
        id: 'tool-call-1',
        role: 'tool',
        callId: 'call-1',
        name: 'read_file',
        arguments: '{"path":"README.md"}',
        status: 'success',
        result: {
          content: [{ type: 'text', text: 'contents' }],
          isError: false,
        },
      },
    ]);
  });

  it('marks failed DSH tool results as errors', () => {
    const projector = new DshSessionProjector();
    projector.project(event({
      type: 'tool/call',
      data: { turn: 1, step: 1, callId: 'call-1', name: 'shell', arguments: '{}' },
    }));
    projector.project(event({
      type: 'tool/result',
      data: {
        turn: 1,
        step: 1,
        message: {
          source: { kind: 'tool', callId: 'call-1' },
          content: [{ type: 'tool-result', callId: 'call-1', isError: true, content: [{ type: 'text', text: 'failed' }] }],
        },
        error: { name: 'Error', code: 'TOOL_FAILED' },
      },
    }));
    expect(projector.getSnapshot().messages[0]).toMatchObject({
      role: 'tool',
      status: 'error',
      result: {
        content: [{ type: 'text', text: 'failed' }],
        isError: true,
        error: { name: 'Error', code: 'TOOL_FAILED' },
      },
    });
  });

  it('returns to idle and ignores late chunks after cancellation', () => {
    const projector = new DshSessionProjector();
    projector.addUser([{ type: 'text', text: 'cancel me' }]);
    projector.project(event({ type: 'turn/start', data: { turn: 1 } }));
    projector.cancel();
    projector.project(event({ type: 'assistant/chunk', data: { turn: 1, chunk: { type: 'text-delta', text: 'late' } } }));
    projector.project(event({ type: 'turn/end', data: { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } } }));
    expect(projector.getSnapshot()).toEqual({
      busy: false,
      todos: [],
      messages: [
        {
          id: 'user-0',
          role: 'user',
          content: [{ type: 'text', text: 'cancel me' }],
          displayContent: [{ type: 'text', text: 'cancel me' }],
        },
        {
          id: 'system-1',
          role: 'system',
          content: [{ type: 'text', text: 'Request cancelled.' }],
          status: 'cancelled',
        },
      ],
    });
  });

  it('preserves reasoning, images, and plugin content across final reconciliation', () => {
    const projector = new DshSessionProjector();
    projector.project(event({ type: 'turn/start', data: { turn: 1 } }));
    projector.project(event({ type: 'assistant/chunk', data: { turn: 1, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: 'think' } } }));
    projector.project(event({
      type: 'assistant/message',
      data: {
        turn: 1,
        step: 1,
        message: {
          content: [
            { type: 'reasoning', text: 'think' },
            { type: 'text', text: 'answer' },
            { type: 'image', attachment: { attachmentId: 'image-1', mediaType: 'image/png', bytes: 4, width: 2, height: 2 } },
            { type: 'chart', series: [1, 2] },
          ],
        },
      },
    }));

    expect(projector.getSnapshot().messages[0]).toMatchObject({
      id: 'assistant-1-1',
      content: [
        { type: 'reasoning', text: 'think' },
        { type: 'text', text: 'answer' },
        { type: 'image', attachment: { attachmentId: 'image-1' } },
        { type: 'extension', blockType: 'chart', payload: { type: 'chart', series: [1, 2] } },
      ],
    });
  });

  it('preserves tool presentation metadata and projects todo snapshots', () => {
    const projector = new DshSessionProjector();
    projector.project(event({
      type: 'tool/result',
      data: {
        turn: 1,
        step: 1,
        message: {
          source: { kind: 'tool', callId: 'call-1' },
          content: [{ type: 'tool-result', toolCallId: 'call-1', content: [{ type: 'chart', values: [3] }] }],
        },
        meta: { presentation: 'chart' },
      },
    }));
    projector.project(event({
      type: 'todo/write',
      data: { todos: [{ content: 'Ship projector', status: 'in_progress' }] },
    }));

    expect(projector.getSnapshot()).toMatchObject({
      todos: [{ content: 'Ship projector', status: 'in_progress' }],
      messages: [{
        role: 'tool',
        result: {
          content: [{ type: 'extension', blockType: 'chart' }],
          isError: false,
          meta: { presentation: 'chart' },
        },
      }],
    });

    projector.project(event({ type: 'todo/write', data: { todos: [] } }));
    expect(projector.getSnapshot().todos).toEqual([]);
  });

  it('projects DSH usage and tool outcomes into session metrics', () => {
    const projector = new DshSessionProjector('session-1', 'deepseek-chat');
    projector.project(event({
      type: 'assistant/chunk',
      data: {
        turn: 1,
        step: 1,
        chunk: {
          type: 'usage',
          usage: {
            inputTokens: 8,
            outputTokens: 5,
            cacheReadTokens: 2,
            cacheWriteTokens: 3,
            reasoningTokens: 1,
          },
        },
      },
    }));
    projector.project(event({
      type: 'assistant/message',
      data: {
        turn: 1,
        step: 1,
        message: { content: [{ type: 'text', text: 'done' }] },
        usage: {
          inputTokens: 8,
          outputTokens: 5,
          cacheReadTokens: 2,
          cacheWriteTokens: 3,
          reasoningTokens: 1,
        },
      },
    }));
    projector.project(event({
      type: 'tool/call',
      data: { turn: 1, step: 1, callId: 'call-1', name: 'shell', arguments: '{}' },
    }));
    projector.project(event({
      type: 'tool/result',
      data: {
        turn: 1,
        step: 1,
        message: {
          source: { kind: 'tool', callId: 'call-1' },
          content: [{ type: 'tool-result', callId: 'call-1', isError: false, content: [] }],
        },
      },
    }));

    expect(projector.getSessionStats()).toMatchObject({
      sessionId: 'session-1',
      lastPromptTokenCount: 13,
      metrics: {
        models: {
          'deepseek-chat': {
            requests: 1,
            tokens: {
              inputTokens: 8,
              outputTokens: 5,
              cacheReadTokens: 2,
              cacheWriteTokens: 3,
              reasoningTokens: 1,
              totalTokens: 18,
            },
          },
        },
        tools: {
          totalCalls: 1,
          totalSuccess: 1,
          totalFail: 0,
          byName: { shell: { count: 1, success: 1, fail: 0 } },
        },
      },
    });
  });
});
