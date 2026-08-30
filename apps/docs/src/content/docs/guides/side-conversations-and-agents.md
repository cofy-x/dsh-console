---
title: Side Conversations and Agents
description: Ask parallel side questions and inspect delegated Agent history without changing it.
---

## Side conversations

Run `/btw <question>` to open a temporary multi-turn Side conversation without interrupting the Main Agent. The Side conversation has its own canonical DSH Agent and Session, can continue across follow-up prompts, and may run while Main is working.

Press `Ctrl+/` to switch between Main and Side. The footer identifies the active conversation and shows whether Main is working or idle. Side output does not become part of the Main conversation context, and Side Sessions are excluded from the main `/sessions` browser.

Use Side for clarification, exploration, or a parallel question. Use Main for changes and decisions that must remain in the primary project conversation.

## Delegated Agents

Run `/agents` to open the DSH-native Agent catalog. It shows nested delegation, live running state, and completed Agents associated with the current runtime.

Select an Agent and press Enter to inspect its canonical conversation history. The history view is read-only: prompts, tools, reasoning, results, errors, usage, and completion state can be reviewed, but Console does not inject messages into a delegated Agent or modify its Session.

Subagent execution and persistence remain owned by DSH. Console observes canonical state and events; it does not create a parallel subagent scheduler or transcript store.
