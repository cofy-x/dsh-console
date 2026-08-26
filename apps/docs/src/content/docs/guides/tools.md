---
title: Tools and Permissions
description: Inspect the active DSH tool catalog, results, approvals, and permission presets.
---

Tool calls and results arrive through canonical DSH Session events. The Console projects calls, structured results, errors, and presenter metadata into Tool Cards instead of rendering raw SDK objects in React.

Run `/tools` to browse tools visible to the active DSH Agent. Run `/permission` to inspect or select a permission preset exposed by the DSH runtime.

When DSH requests approval or asks a user question, the Console opens a focused dialog and returns the response through the corresponding DSH service. DSH remains responsible for tool execution and policy enforcement.

Prefix a local command with `!` to use shell mode. Shell mode executes locally and never submits the command or output as a model prompt.
