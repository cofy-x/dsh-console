# Parallel Side Conversations

## Status

Implemented.

## Context

Users sometimes need a quick clarification while the main Agent is working, but submitting that question to the active conversation interrupts the current turn and permanently changes its canonical history.

## Decision

`/btw <question>` creates an isolated DSH Agent whose Session is parented to the current Console Session. It receives only the parent's completed-turn prefix plus a textual description of any currently pending user request, uses the active model and reasoning effort, and has no model-visible tools. The Console switches to the Side surface, where the user can continue a multi-turn conversation while the Main Agent keeps running independently. Side content is never projected into or submitted to the Main Agent. The command declares that it may run while the Console is busy, while ordinary slash and shell commands retain the existing queue rejection policy.

The lifecycle is owned by `ConversationWorkspaceRuntime`, which exposes one stable `ConversationRuntime` to React while routing snapshots, submissions, cancellation, and stats to Main or Side. `/main`, `/side`, and `Ctrl+/` switch surfaces without stopping either Agent. `Ctrl+C` cancels a working Side turn; while Side is idle it closes Side and returns to Main. Side Sessions use the `dsh-console-side-*` prefix and are excluded from top-level Session management by both their parent relationship and an explicit prefix guard.

## Alternatives

Submitting the question to the active Main Agent was rejected because it interrupts and mutates the main task. Reusing prompt completion was rejected because completion has different prompting, validation, and lifecycle semantics. Extending the original one-shot Dialog was rejected because it would duplicate conversation projection, input, and cancellation behavior outside the canonical Console runtime.

## Consequences

The Main Agent can continue working while Side produces multiple turns. Side shares stable completed context but does not see partial assistant output from an in-flight Main turn, and Side output is not merged back automatically. The first version supports text input only and has no attachments or tools. Model and top-level Session management remain Main-owned and require switching to `/main`.

## Verification

Runtime tests cover completed-context seeding, multi-turn routing, parallel Main updates, surface switching, cancellation, closing, isolation, and disposal. Command and Footer tests cover usage validation, transcript suppression, navigation, busy state, and Side identity.
