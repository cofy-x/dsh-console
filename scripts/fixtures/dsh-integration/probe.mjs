/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeFile } from 'node:fs/promises';
import { installModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

export const name = 'dsh-console-integration-probe';
export const inject = [
  'dshConsoleIntegration',
  'agents',
  'sessions',
  'sessionQuery',
  'tools',
  'attachments',
  'llm',
  'approval',
  'userQuestions',
  'commands',
  'appExit',
];

function snapshotSessionEvents(session) {
  if (typeof session.snapshotEvents === 'function') {
    return session.snapshotEvents();
  }
  if (Array.isArray(session.events)) return session.events;
  throw new Error(
    `DSH Session ${String(session.id)} does not expose an event snapshot API.`,
  );
}

async function run(ctx) {
  const integration = ctx.get('dshConsoleIntegration');
  const agents = ctx.get('agents');
  const sessions = ctx.get('sessions');
  const required = [
    'sessionQuery',
    'tools',
    'attachments',
    'llm',
    'approval',
    'userQuestions',
    'commands',
  ];
  for (const service of required) {
    if (ctx.get(service) === undefined) {
      throw new Error(`missing DSH service: ${service}`);
    }
  }
  if (!integration || !agents || !sessions) {
    throw new Error(
      'missing DSH Console integration, Agent, or Session service',
    );
  }

  const eventTypes = [];
  const off = ctx.on('session/event', (session, event) => {
    if (String(session.id) !== 'dsh-console-integration') return;
    if (
      ['user/message', 'assistant/message', 'turn/end'].includes(event.type)
    ) {
      eventTypes.push(event.type);
    }
  });
  const handle = await agents.create({
    sessionId: 'dsh-console-integration',
    meta: { cwd: process.cwd() },
    agentOptions: {
      provider: integration.provider,
      model: integration.model,
    },
    setup(agentCtx) {
      installModelSelection(agentCtx, {
        current: {
          provider: integration.provider,
          model: integration.model,
        },
        assembled: undefined,
      });
    },
  });
  try {
    handle.agent.followup(
      createUserMessage({
        content: [
          { type: 'text', text: 'Verify the DSH Console composition.' },
        ],
        source: { kind: 'user' },
      }),
    );
    await handle.agent.whenIdle();
    const assistant = snapshotSessionEvents(handle.agent.session).findLast(
      (event) => event.type === 'assistant/message',
    );
    const assistantText = assistant?.data.message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const flushed = await sessions.flush(handle.agent.session);
    await writeFile(
      process.env.DSH_CONSOLE_INTEGRATION_RESULT,
      JSON.stringify({
        assistantText,
        eventTypes,
        flushed,
        sessionId: String(handle.agent.session.id),
      }),
    );
  } finally {
    off();
    await handle.dispose();
  }
  ctx.get('appExit')(0);
}

export function apply(ctx) {
  void run(ctx).catch((error) => {
    process.stderr.write(`dsh-console integration probe: ${String(error)}\n`);
    ctx.get('appExit')?.(1);
  });
}
