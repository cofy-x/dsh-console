# Agent Notes

Agent Notes are durable design records for decisions whose rationale, alternatives, and consequences cannot be recovered reliably from code or API documentation alone.

## When to write a note

Write an Agent Note for a non-trivial architecture decision, user-facing capability contract, release process, compatibility policy, or simplification that future maintainers could otherwise reverse accidentally.

Do not write an Agent Note for mechanical edits, local implementation details, routine dependency updates, test-only refactors, or a transcript of the implementation process.

## Layout and naming

Agent Notes use `{lifecycle}/{class}/yyyy-mm-dd-topic.md` paths. The date records when the decision was first documented.

Lifecycle directories are:

- `proposed/` for decisions that require agreement before implementation.
- `implemented/` for decisions represented by the shipped product.
- `rejected/` for declined proposals whose rationale still prevents a meaningful mistake.
- `archived/` for frozen records that are no longer current authority.

Classes are:

- `architecture` for runtime ownership, package relationships, and durable data flow.
- `feature` for user-visible behavior and product contracts.
- `process` for development, release, and repository policy.
- `simplification` for intentional removal of behavior or surface area.
- `testing` for test strategy and infrastructure.
- `bug-fix` for corrections whose cause and prevention need a durable record.

The active directory tree is the inventory; do not maintain a separate generated index.

## Note format

Each note contains `Status`, `Context`, `Decision`, `Alternatives`, `Consequences`, and `Verification` sections. State durable facts and tradeoffs directly; do not preserve reasoning transcripts, temporary investigation details, or commit-by-commit history.

## Maintenance

Implemented notes remain current when paths, package names, commands, or other factual references change. If a later decision fully replaces a note, move the old record to `archived/` without rewriting its historical content. Partially superseded notes remain active and cross-link the newer decision.

## Markdown style

Keep each prose paragraph on one physical line. Do not hard-wrap Markdown prose to a fixed column width.
