# AGENTS.md

## Repository purpose

`dsh-console` is a public TypeScript and React/Ink terminal frontend for DeepSeek Harness (DSH). DSH owns agent execution, sessions, models, attachments, tools, persistence, and canonical events. This repository owns terminal interaction, presentation, input preparation, and DSH-facing adapters.

The public npm package and CLI are both named `@cofy-x/dsh-console` and `dsh-console`. The repository remains a multi-package pnpm workspace.

## Development direction

- Build new capabilities against public DSH services and canonical types.
- Do not modify or patch DeepSeek Harness from this repository.
- Do not duplicate providers, authentication, agent execution, session persistence, or other runtime responsibilities already owned by DSH.
- Preserve useful terminal UX and generic React/Ink components when they have a clear DSH-native implementation.
- Before deleting an existing feature, determine whether it is generic UI, obsolete runtime logic, or a useful capability awaiting a DSH adapter.
- Prefer small, complete vertical slices over optional methods that have no working DSH implementation.

## Architecture boundaries

### DSH boundary

- Use official canonical DSH types at service and event boundaries, including session events, content blocks, attachment references, tool events, todo events, and usage data.
- Keep DSH SDK access inside focused runtime adapters and projectors.
- Do not duplicate canonical DSH contracts with permissive local types such as `Record<string, unknown>` when an official type exists.
- Do not fabricate canonical attachment references or session events before DSH accepts and persists them.

### TUI boundary

- React components consume stable, presentation-oriented View Models rather than the full DSH SDK surface.
- Project canonical events into user, assistant, reasoning, attachment, tool, todo, interruption, error, and usage View Models before rendering.
- Unknown extension blocks must use a registered renderer or a safe fallback; they must not crash the terminal or silently lose data.
- Keep terminal lifecycle, alternate-screen cleanup, resize behavior, and working/idle cancellation semantics explicit and testable.

### Runtime ownership

- Keep conversation, session management, model selection, prompt completion, attachment admission, tool catalog, approvals, and user questions as separate runtime interfaces when their lifecycles differ.
- Agent switching and session resume must be transactional: prepare the candidate first, preserve the active conversation on failure, then swap and dispose the previous agent.
- DSH session events and persistence are the source of truth. Do not introduce a parallel local conversation store.
- Prompt display content may preserve the user's original input, while canonical content must exactly represent what was admitted to DSH.

## UI and command behavior

- Reuse the established React/Ink visual language and generic Command/Dialog infrastructure instead of replacing the TUI wholesale.
- Commands that require browsing or configuration should prefer dedicated dialogs when that improves keyboard interaction and clarity.
- Shell mode is local terminal execution and must not submit a prompt to the model.
- During local input preparation, `Ctrl+C` aborts preparation and restores the prompt without creating a turn. During an active DSH turn, it cancels that turn. While idle, it exits and restores the terminal.
- Features such as session management, model selection, attachments, tools, and prompt completion must remain DSH-native and must not depend directly on provider-specific APIs.

## Workspace and tooling

- Use Node.js 24 or newer and pnpm 11.
- The workspace root is private and coordinates shared scripts.
- `apps/cli` contains the public `@cofy-x/dsh-console` package and CLI.
- Internal workspace packages may remain private implementation boundaries; do not rename or flatten them as part of unrelated feature work.
- Use `pnpm` workspace commands rather than installing dependencies in an individual package with another package manager.

Common checks:

```sh
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build:cli
pnpm run test:ci
pnpm run test:integration:dsh
pnpm run test:package
```

`format:check` incrementally enforces Prettier on changed files without rewriting the working tree. Run the smallest relevant checks while iterating. Before a public-ready change, run the complete applicable gate, including DSH composition and packaged installation when package or launcher behavior changes.

## Change discipline

- Keep commits logically cohesive and independently buildable.
- Do not mix feature migration, unrelated cleanup, and workspace restructuring in one commit.
- Delete obsolete code only after checking callers and identifying whether a DSH-native replacement is required to preserve useful behavior.
- Avoid broad mechanical renames of internal types, files, or packages.
- Preserve Apache-2.0 licensing and accurate copyright and third-party notices.
- Never commit credentials, tokens, private registry configuration, internal endpoints, personal filesystem paths, or private development material.
- Keep the npm tarball limited to the public launcher, runtime output, DSH bundle metadata, documentation, license, and notices.

## Git and publication

- Local commits are allowed after the relevant checks pass.
- Follow the repository's configured contribution, review, and release workflow for remote operations.
- Do not create tags, publish npm packages, rewrite public history, or modify remotes unless the user explicitly requests that operation.

## Out of scope by default

- Changes to DSH core or private DSH APIs.
- Provider-specific authentication, agent execution, or session persistence that bypasses DSH ownership.
- Large UI rewrites while implementing an isolated DSH capability.
- Orca-specific behavior unless the task explicitly includes Orca validation or integration.

## Documentation decisions

- Keep each Markdown prose paragraph on one physical line. Do not hard-wrap Markdown prose to a fixed column width.
- Keep the shared product facts in the root `README.md` and `README.zh.md` synchronized when user-facing behavior, installation, requirements, or release maturity changes; npm package documentation and Agent Notes remain English-only unless a later decision changes their audience.
- Record durable, non-trivial architecture, product contract, release, compatibility, and simplification decisions under [Agent Notes](.agents/notes/README.md).
- Before changing a documented area, search the active `proposed/` and `implemented/` notes for relevant decisions; do not load unrelated notes or treat `archived/` records as current authority.
- Agent Notes preserve rationale, rejected alternatives, consequences, and verification expectations; they do not preserve reasoning transcripts or temporary implementation history.
- Keep implemented notes factually current and move fully superseded records to the frozen `archived/` lifecycle.
