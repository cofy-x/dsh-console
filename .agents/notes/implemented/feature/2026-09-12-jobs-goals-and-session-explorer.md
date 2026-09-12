# Jobs, Goals, and Reusable Session History

## Status

Implemented; compatibility verification is recorded in the task's validation evidence.

## Context

Console needs to make background execution observable, turn useful history into reusable conversations, and expose the existing goal domain without creating another scheduler, job consumer, or persistence database.

## Decision

`/jobs` and `/goals` consume one active-Agent activity adapter. The adapter observes official job snapshots, fences job cancellation by the confirmed Session, and never calls `jobs.read` or `jobs.wait`. Job output stays in DSH's `job_output` flow rather than being reconstructed from Session events. Producers retain output cursors, notices, process ownership, and cancellation semantics. Main and Side activity remain separate; switching the interactive surface invalidates its observation.

The goal panel exposes creation, objective and round-limit editing, pause, explicit resume, completion, and clearing. Every mutation carries the Session identity and goal revision the user confirmed. DSH owns compare-and-set validation, round accounting, continuation, activation, and current-turn cancellation. Restored goals remain disarmed until explicitly resumed. `/goal ...` stays the native DSH command, including its attachment contract; `/goals` is the additional terminal control surface. A completed in-memory mutation whose persistence checkpoint fails is reported as such, not falsely described as rolled back.

`/sessions` searches canonical event text, ids, and titles in the current directory, previews canonical replay, renames through the title service, and offers persistent forks at completed Turn boundaries. Discovery uses one Console identity policy shared with startup continuation and exact resume. Forks use the reserved `dsh-console-fork-` namespace and DSH parent lineage; arbitrary children, Side Sessions, and completion Sessions remain excluded. Forks restore the selected prefix's model route and inherit the source Agent's composition through the preset service. The new Session is flushed before replacing the active conversation. Forking never rolls back filesystem changes and never submits a prompt automatically.

The title service requires an exact live Session, while the Agent factory owns its persistence writer. Renaming an inactive Session therefore obtains a short-lived canonical resume lease, writes the user-pinned title, checkpoints it, and releases the lease without submitting model work or replacing the visible Agent. Console does not edit JSONL directly. Seed compatibility between the two supported DSH endpoints is isolated in `session-events.ts`.

The Console bundle opts into DSH's existing SQLite search provider with `openAt: first-search` and a derived index under `DSH_HOME`. The base bundle deliberately disables full-text search; requiring callers to enable it manually would leave the default Console workflow incomplete. Opening only on first search preserves lazy startup. JSONL remains the source of truth, the index is owned and rebuildable by DSH, and later user profile overrides retain precedence.

## Alternatives

A parallel job output consumer was rejected because it would steal the Agent's stream cursor and suppress completion notices. A Console goal loop was rejected because it would duplicate DSH scheduling and activation policy. Copying a rendered transcript into a new chat was rejected because it loses canonical tool, model, goal, and preset state. An independent title database was rejected because restart and other DSH clients would disagree.

## Consequences

Activity status is a compact conditional row rather than permanent multi-pane chrome. Dialogs provide explicit confirmation before stopping work, arming goals, replacing the current transcript, or creating a fork. History stays scoped to the current directory; cross-directory navigation and deletion are separate product decisions. Job resources remain process-local and are not resurrected by Session replay. Canonical history previews are paged and terminal-control-safe; non-text blocks retain type markers.

## Verification

Focused adapter tests cover owner isolation, non-consuming observation, stale goal revisions, activation, persistence failures, title writes, search scoping, cancellation, fork boundaries, and prefix model restoration. Dialog tests cover empty/error states, cancellation, and disarmed presentation. The real DSH composition probe covers job cancellation without output reads, goal and title persistence, indexed search, completed-turn forks, and restored activation. The PTY product path opens all three panels, forks a real conversation, and continues invoking a Skill in the inherited context. Both configured compatibility endpoints are required before claiming compatibility completion.
