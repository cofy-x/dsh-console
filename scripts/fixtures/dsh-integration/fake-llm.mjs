/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { LlmAdapter } from '@deepseek-ai/dsh-llm';

const PROVIDER = 'dsh-console-fake';
const MODEL = 'alpha';

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

  async *stream() {
    const text = 'DSH Console integration ready.';
    yield { type: 'block-start', index: 0, blockType: 'text' };
    yield { type: 'text-delta', index: 0, text };
    yield { type: 'block-end', index: 0, block: { type: 'text', text } };
    yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 5 } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}

export const name = 'dsh-console-integration-fake-llm';
export const inject = ['llm'];

export function apply(ctx) {
  ctx.llm.registerAdapter([PROVIDER], new FakeAdapter());
  ctx.provide('dshConsoleIntegration', {
    provider: PROVIDER,
    model: MODEL,
  });
}
