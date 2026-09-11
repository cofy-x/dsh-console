# Agent Presets and Skills in the Terminal

## Status

Implemented.

## Context

DeepSeek Harness owns per-session Agent composition and Skill invocation. DSH Console previously created bare Agents and treated every leading slash as a command, so it could neither preserve a Session's selected composition nor route user-invocable Skills through the Harness pre-step.

## Decision

Every Main Agent is composed through the DSH Agent preset service before publication. New Sessions retain a pending preset selection without creating an Agent; the first operation that needs an Agent mounts that exact preset and records it in Session metadata. Restored Sessions mount the preset from the canonical projection, and Side Sessions inherit the Main Agent's standing composition before applying their existing tool restriction. `/preset` discovers the roster independently from Agent creation and exposes selection only while Harness still considers the Session blank, so a broken default cannot prevent the user from seeing and choosing another preset. Console does not author or edit preset files.

The terminal exposes user-invocable Skills through `/skills` and Slash completion. A recognized Skill line remains literal user text and is submitted through the ordinary prompt path so the Harness pre-step owns validation and instruction injection. Console builtin commands win name conflicts, followed by DSH commands, then Skills. Argument completion accepts either legacy strings or structured values with descriptions; `/preset` uses the structured form to retain stable ids while displaying DSH-owned names, descriptions, and current/default state. The normal catalog path reads the Host-owned layered Skill registry with `scope: agent`; a custom preset that publishes an isolated registry is addressed through `AgentPresets.serviceFor`. The catalog follows the currently interactive Main or Side Agent and is invalidated on surface, Session, preset, or registry changes. Shared roster and Skill loads own their lifecycle; cancellation by completion or command UI stops only that caller's wait, while active-Agent changes and runtime disposal own generation invalidation and underlying cancellation.

DSH command descriptors retain their attachment policy and successful source event sequence. Console encodes validated local image references only for commands that advertise attachment support. Until Console projects richer command-domain events, returned command text remains the visible acknowledgement.

## Alternatives

A startup preset wizard was rejected because it would slow the current lazy terminal startup. A Console-owned Skill parser or instruction injector was rejected because it would duplicate Harness policy and break replay. Preset authoring and Web-style command or deliverable surfaces were rejected because they add substantial scope without improving the core terminal workflow.

## Consequences

Preset selection, command discovery, tools, and Skills now share the active Session composition. Presets are selected with `/preset`, Skills are inspected with `/skills`, and Skill invocation remains portable across Harness entry points. Image attachments are supported for DSH commands; staged generic files remain outside the Console input contract.

## Verification

Focused tests cover descriptor projection, command image encoding, preset projection and pending selection, scoped Skill filtering, caller-local cancellation, and command-versus-Skill routing. The DSH integration gate also launches the actual CLI in a PTY, changes the pending preset, opens both dialogs, materializes the standard composition, discovers and invokes a filesystem Skill, and exits through `/quit`. Both configured DSH compatibility endpoints remain required release gates.
