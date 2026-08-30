---
title: Tools and Permissions
description: Inspect the active DSH tool catalog, results, approvals, and permission presets.
---

Tool calls and results arrive through canonical DSH Session events. The Console projects calls, structured results, errors, and presenter metadata into Tool Cards instead of rendering raw SDK objects in React.

Tool Card headers stay compact. A genuinely truncated title or shell command can be expanded in place from the header, while canonical arguments and result details remain in the card body instead of being duplicated in the title.

Run `/tools` to browse tools visible to the active DSH Agent. Run `/permission` to inspect or select a permission preset exposed by the DSH runtime.

When DSH requests approval or asks a user question, the Console opens a focused dialog and returns the response through the corresponding DSH service. DSH remains responsible for tool execution and policy enforcement.

The Todo tray reflects the latest canonical DSH todo snapshot. After a turn finishes, an unfinished item means the model left that item pending; it does not mean that Console work is still running. Press `Ctrl+T` to expand or collapse the full list.

Prefix a local command with `!` to use shell mode. Shell mode executes locally and never submits the command or output as a model prompt.
