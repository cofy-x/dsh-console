---
title: DSH-native Architecture
description: Understand the ownership boundary between DeepSeek Harness and DSH Console.
---

DeepSeek Harness owns agent execution, model and provider services, credentials, Sessions, tools, approvals, attachments, persistence, and canonical events. DSH Console owns terminal interaction, input preparation, presentation, and focused adapters to those public services.

At the DSH boundary, runtime adapters consume official canonical types. A Session projector converts canonical user, assistant, reasoning, image, tool, todo, interruption, error, and usage events into stable TUI View Models. React components do not depend on the complete DSH SDK surface.

Live streaming and Session replay share the same projector. DSH JSONL logs and attachment storage remain the only persistent source of truth; the Console does not create a second conversation store.

Main, Side, and delegated Agent views remain separate canonical DSH Sessions. `/btw` creates an isolated Side conversation, while `/agents` projects delegated Agent state and history as read-only views. Console does not copy events between these Sessions or run another Agent scheduler.

Attachments are admitted before a turn is created. Agent and Session switches prepare a candidate first and only replace the active runtime after validation and flush succeed. These boundaries keep failures from silently changing model context or losing the visible conversation.

The initial Main Agent is lazy. Console can open settings, discover DSH commands, or exit without persisting an empty Session; it materializes the Agent only when an operation actually requires canonical Agent state.
