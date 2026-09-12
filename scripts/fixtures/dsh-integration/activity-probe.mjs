/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { installModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

export async function verifyActivityAndHistory(ctx, integration) {
  const {
    DshAgentActivityRuntime,
    DshSessionExplorerRuntime,
    snapshotSessionEvents,
    forkSeedOptions,
  } = await import(process.env.DSH_CONSOLE_ACTIVITY_ADAPTER);
  const model = { provider: integration.provider, model: integration.model };
  const sourceId = 'dsh-console-feature-source';
  const create = (sessionId, extra = {}) =>
    ctx.agents.create({
      sessionId,
      agentOptions: model,
      ...extra,
      setup: async (agentCtx) => {
        installModelSelection(agentCtx, {
          current: model,
          assembled: undefined,
        });
        await ctx.agentPresets.mount(agentCtx, 'standard');
      },
    });
  let source = await create(sourceId, {
    meta: { cwd: process.cwd(), agentPreset: 'standard' },
  });
  let active = source.agent;
  let child;
  const activity = new DshAgentActivityRuntime(
    ctx.jobs,
    ctx.goals,
    ctx.sessions,
    () => active,
    async () => {
      throw new Error('unexpected lazy Agent');
    },
    (listener) => ctx.on('session/event', listener),
    (listener) => ctx.on('goal/activation-changed', listener),
  );
  const offController = ctx.jobs.attachController('console-feature-probe');
  try {
    let reads = 0;
    let settle;
    const done = new Promise((resolveDone) => {
      settle = resolveDone;
    });
    const jobId = ctx.jobs.start({
      kind: 'bash',
      label: 'deterministic background probe',
      owner: source.agent,
      run: () => ({
        done,
        cancel: () => settle({ status: 'killed', output: 'stopped' }),
        readOutput: () => {
          reads += 1;
          return 'unconsumed';
        },
      }),
    });
    assert.ok(activity.getSnapshot().jobs.some((job) => job.id === jobId));
    assert.equal(reads, 0);
    assert.equal(ctx.jobs.get(jobId, source.agent).reported, false);
    activity.stopJob(sourceId, jobId);
    await done;
    await new Promise((resolveTurn) => setImmediate(resolveTurn));
    assert.equal(ctx.jobs.get(jobId, source.agent).status, 'killed');
    assert.equal(reads, 0, 'Console observation must never consume job output');

    const initialGoal = ctx.goals.create(source.agent, {
      objective: 'Persist a paused goal',
      maxGoalRounds: 3,
    });
    ctx.goals.pause(source.agent, {
      id: initialGoal.id,
      revision: initialGoal.revision,
    });
    await source.agent.whenIdle();
    const observation = activity.getSnapshot();
    await activity.changeGoal(
      { sessionId: sourceId, goal: observation.goal },
      {
        kind: 'edit',
        objective: 'Persist the edited paused goal',
        maxGoalRounds: 4,
      },
    );
    assert.equal(ctx.goals.get(source.agent).phase, 'paused');

    source.agent.followup(
      createUserMessage({
        source: { kind: 'user' },
        content: [
          { type: 'text', text: 'Searchable durable console feature history.' },
        ],
      }),
    );
    await source.agent.whenIdle();
    await ctx.sessions.flush(source.agent.session);
    const management = {
      getSnapshot: () => ({
        currentSessionId: String(active?.session.id ?? sourceId),
      }),
      isBusy: () => false,
    };
    const explorer = new DshSessionExplorerRuntime(
      ctx.sessionQuery,
      ctx.llm,
      process.cwd(),
      management,
      { presentCall: () => undefined, presentResult: () => undefined },
      {
        list: async (signal) => {
          const records = await ctx.sessionQuery.filterSessions(
            [{ kind: 'cwd', values: [process.cwd()] }],
            signal,
          );
          return records.map((record) => {
            const live = ctx.sessions.get(record.header.id);
            const values =
              live === undefined
                ? undefined
                : ctx.sessionProjections.cachedSnapshot(live)?.values;
            return {
              id: String(record.header.id),
              updatedAt: record.header.createdAt,
              running: false,
              blank: live?.seq === 0 || false,
              blankKnown: live !== undefined,
              persisted: record.persisted,
              ...(record.header.cwd === undefined
                ? {}
                : { cwd: record.header.cwd }),
              ...(record.header.parentSession === undefined
                ? {}
                : { parentSessionId: String(record.header.parentSession) }),
              ...(record.header.origin === undefined
                ? {}
                : { origin: record.header.origin }),
              ...(typeof values?.title === 'string'
                ? { title: values.title }
                : {}),
            };
          });
        },
        search: async (query, sessionIds, signal) => {
          const result = await ctx.sessionQuery.searchSessions(
            {
              query,
              sessionFilters: [{ kind: 'id', values: sessionIds }],
              limit: 100,
            },
            { signal },
          );
          return {
            hasMore: result.nextCursor !== undefined,
            items: result.items.map((item) => ({
              id: String(item.header.id),
              snippet: item.bestMatch.snippet,
            })),
          };
        },
        rename: async (id, title) => {
          const live = ctx.sessions.get(id);
          const lease = live
            ? undefined
            : await ctx.agents.resume({
                resumeSessionId: id,
                agentOptions: model,
              });
          try {
            const session = live ?? lease.agent.session;
            const result = ctx.sessionTitle.rename(session, title);
            assert.equal(await ctx.sessions.flush(session), true);
            return result.title;
          } finally {
            await lease?.dispose();
          }
        },
        fork: async (id, seed) => {
          const options = forkSeedOptions(seed);
          child = await create('dsh-console-fork-feature-probe', {
            ...options,
            meta: {
              ...options.meta,
              cwd: process.cwd(),
              parentSession: id,
              agentPreset: 'standard',
            },
          });
          assert.equal(await ctx.sessions.flush(child.agent.session), true);
          active = child.agent;
          activity.activeAgentChanged();
        },
        adoptCurrentModel: () => {},
      },
    );
    assert.ok(
      (await explorer.search('Searchable durable')).items.some(
        (item) => item.id === sourceId,
      ),
    );
    const preview = await explorer.preview(sourceId);
    assert.ok(preview.messages.some((message) => message.role === 'assistant'));
    assert.ok(preview.turns.length > 0);
    await explorer.fork(sourceId, preview.turns.at(-1).seq);
    assert.equal(child.agent.session.header.parentSession, sourceId);
    assert.equal(ctx.goals.get(child.agent).phase, 'paused');
    assert.equal(ctx.goals.get(child.agent).activation, 'disarmed');
    assert.ok(
      snapshotSessionEvents(child.agent.session).some(
        (event) => event.type === 'assistant/message',
      ),
    );
    assert.ok(
      (await explorer.search('')).items.some(
        (item) => item.id === 'dsh-console-fork-feature-probe',
      ),
    );

    await source.dispose();
    source = undefined;
    await explorer.rename(sourceId, 'Pinned offline Session title');
    const [title] = await ctx.sessionQuery.readTitleSnapshots([sourceId]);
    assert.equal(title.status, 'fulfilled');
    assert.equal(title.value.title.title, 'Pinned offline Session title');
    assert.ok(
      (await explorer.search('Pinned offline')).items.some(
        (item) => item.id === sourceId,
      ),
    );
    const resumed = await ctx.agents.resume({
      resumeSessionId: sourceId,
      agentOptions: model,
    });
    try {
      assert.equal(
        ctx.goals.get(resumed.agent).objective,
        'Persist the edited paused goal',
      );
      assert.equal(ctx.goals.get(resumed.agent).activation, 'disarmed');
    } finally {
      await resumed.dispose();
    }
    return { jobs: true, goals: true, search: true, rename: true, fork: true };
  } finally {
    activity.dispose();
    offController();
    await child?.dispose();
    await source?.dispose();
  }
}
