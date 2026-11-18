/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { installModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

export async function verifyOfficialPresets(ctx, integration) {
  const roster = await ctx.agentPresets.list();
  const officialIds = ['standard', 'ptc', 'minimal', 'cordis'];
  assert.deepEqual(
    roster.map((preset) => preset.id),
    officialIds,
    'Console must expose the complete official DSH preset roster',
  );
  for (const preset of roster) {
    assert.equal(preset.broken, undefined, `${preset.id}: ${preset.broken}`);
  }

  // Host inspection is ready before any Agent is materialized. Loading its
  // runner must not start an Agent or require a browser connection.
  assert.equal(ctx.agents.list().length, 0);
  const inspection = ctx.get('cordisInspect');
  assert.ok(inspection, 'the Cordis preset requires the DSH Host registry');
  assert.deepEqual(
    inspection
      .list()
      .filter((provider) => provider.platform === 'host')
      .map((provider) => provider.id)
      .sort(),
    ['Config', 'Event', 'Service', 'Tool'],
  );

  const model = { provider: integration.provider, model: integration.model };
  for (const id of officialIds) {
    const handle = await ctx.agents.create({
      sessionId: `dsh-console-preset-probe-${id}`,
      meta: { cwd: process.cwd(), agentPreset: id },
      agentOptions: model,
      setup: async (agentCtx) => {
        installModelSelection(agentCtx);
        await ctx.agentPresets.mount(agentCtx, id);
      },
    });
    try {
      const tools = new Set(
        ctx.tools.schemas(handle.agent).map((tool) => tool.name),
      );
      assert.ok(tools.has(process.platform === 'win32' ? 'pwsh' : 'bash'));
      assert.ok(tools.has('read_image'), `${id} must support image reading`);
      if (id === 'minimal') {
        for (const name of [
          'read',
          'write',
          'edit',
          'subagent',
          'subagent_fork',
          'list_agents',
          'todo_write',
          'web_search',
          'run_code',
          'cordis_inspect_list',
        ]) {
          assert.equal(
            tools.has(name),
            false,
            `minimal must not inherit the Host's ${name} tool`,
          );
        }
      } else {
        for (const name of [
          'read',
          'write',
          'edit',
          'subagent',
          'list_agents',
        ]) {
          assert.ok(tools.has(name), `${id} must expose ${name}`);
        }
        assert.equal(tools.has('cordis_inspect_list'), id === 'cordis');
        assert.equal(tools.has('cordis_inspect_query'), id === 'cordis');
        assert.equal(
          tools.has('interrupt_agent'),
          false,
          `${id} keeps the official delegation policy`,
        );
      }
      if (id === 'ptc') {
        handle.agent.followup(
          createUserMessage({
            source: { kind: 'user' },
            content: [{ type: 'text', text: 'Verify the PTC request schema.' }],
          }),
        );
        await handle.agent.whenIdle();
        assert.deepEqual(
          handle.agent.session.requestHeader()?.tools?.map((tool) => tool.name),
          ['run_code'],
          'The scoped PTC executor must expose one program tool in the model request',
        );
      }
      if (id === 'cordis') {
        const result = await inspection.query(
          'host',
          'Tool',
          'listTools',
          undefined,
          handle.agent,
          new AbortController().signal,
        );
        assert.ok(
          result.tools.some((tool) => tool.name === 'cordis_inspect_list'),
          'Cordis Host inspection must read the calling Agent tool scope',
        );
      }
    } finally {
      await handle.dispose();
    }
  }
  assert.equal(ctx.agents.list().length, 0);
}
