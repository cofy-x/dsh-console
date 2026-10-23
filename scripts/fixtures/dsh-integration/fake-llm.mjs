/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';

// Resolve Host peers from the same package boundary as the production adapters.
const require = createRequire(
  new URL('../../../apps/cli/package.json', import.meta.url),
);
const { defineTool } = await import(
  pathToFileURL(require.resolve('@deepseek-ai/dsh-tools')).href
);

const PROVIDER = 'dsh-console-fake';
const MODEL = 'alpha';
const TOOL = 'dsh_console_integration_probe';
const TOOL_CALL = 'dsh-console-integration-probe-call';

class FakeAdapter extends LlmAdapter {
  providerInfo(provider) {
    return { id: provider, name: 'DSH Console Fake Provider' };
  }

  providerRetryPolicy() {
    return undefined;
  }

  listModels() {
    return Promise.resolve([
      {
        id: MODEL,
        name: 'Public Alpha Integration Model',
        inputModalities: ['text', 'image'],
      },
    ]);
  }

  resolveModel(provider, model) {
    return Promise.resolve({
      provider,
      id: model,
      name: 'Public Alpha Integration Model',
      inputModalities: ['text', 'image'],
    });
  }

  async *stream(options) {
    const latestUser = options.messages.findLast(
      (message) => message.role === 'user',
    );
    const toolRequested = latestUser?.content.some(
      (block) =>
        block.type === 'text' &&
        block.text.includes('Verify streamed tool completion.'),
    );
    const toolCompleted = options.messages.some(
      (message) => message.role === 'tool' && message.toolCallId === TOOL_CALL,
    );
    if (toolRequested && !toolCompleted) {
      const block = {
        type: 'tool-call',
        id: TOOL_CALL,
        name: TOOL,
        arguments: '{}',
      };
      yield { type: 'block-start', index: 0, blockType: 'tool-call' };
      yield {
        type: 'tool-call-delta',
        index: 0,
        id: TOOL_CALL,
        name: TOOL,
        argumentsDelta: '{}',
      };
      yield { type: 'block-end', index: 0, block };
      yield { type: 'finish', reason: { kind: 'tool-calls' } };
      return;
    }
    const text = 'DSH Console integration ready.';
    yield { type: 'block-start', index: 0, blockType: 'text' };
    for (const part of ['DSH Console ', 'integration ', 'ready.']) {
      yield { type: 'text-delta', index: 0, text: part };
      // Model transport latency crosses Ink's render boundary, so a first
      // partial frame cannot be hidden by a single synchronous React commit.
      await delay(75, undefined, { signal: options.signal });
    }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } };
    yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 5 } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}

export const name = 'dsh-console-integration-fake-llm';
export const inject = ['llm', 'tools'];

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: TOOL,
      description: 'Exercise deterministic keyless Console tool presentation.',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(_args, exec) {
        await delay(150, undefined, { signal: exec.signal });
        return 'Deterministic Console fixture result.';
      },
      presentCall: () => ({
        card: 'generic',
        title: 'Console integration tool running',
      }),
      presentResult: () => ({
        card: 'generic',
        title: 'Console integration tool complete',
        content: [
          { type: 'text', text: 'Deterministic Console fixture result.' },
        ],
      }),
    }),
  );
  ctx.llm.registerAdapter([PROVIDER], new FakeAdapter());
  ctx.provide('dshConsoleIntegration', {
    provider: PROVIDER,
    model: MODEL,
  });
}
