---
title: Workflows and Plan Review
description: Review DSH plans, approvals, questions, tool work, and todo state without leaving the terminal.
---

DSH Console keeps workflow decisions in focused terminal dialogs while DeepSeek Harness remains responsible for the underlying command, tool, approval, question, and todo contracts.

## Enter plan mode

Run `/plan` to enter the plan workflow supplied by the active DSH profile. DSH commands are discovered lazily before the first prompt, so `/plan` can be selected without creating an otherwise empty startup Session.

When the Agent submits a plan, Console opens a Markdown Plan Review dialog. Choose **Approve** to leave plan mode; execution begins from the next model step. Enter a custom response to request changes and remain in plan mode while the feedback returns to the model.

Plan Review does not infer mode from a failed tool call and does not invent a second plan state. Availability and transitions come from the canonical DSH command and user-question contracts.

## Follow execution

Tool Cards show canonical calls, results, failures, and presenter metadata. Approval and user-question dialogs return decisions through DSH, and the Todo tray shows the latest canonical snapshot rather than a Console-owned task list.

An unfinished todo after an idle turn means the model ended without marking that item complete. It is historical state, not a claim that a hidden operation is still running. Press `Ctrl+T` to inspect the full list.

Use `/stats` for Session and model usage details, `/tools` for the active tool catalog, and `/permission` for permission presets exposed by DSH.
