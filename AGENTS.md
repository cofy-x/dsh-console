# AGENTS.md

## Repository scope

`dsh-console` is the public TypeScript and React/Ink terminal frontend for DeepSeek Harness (DSH). The npm package is `@cofy-x/dsh-console` and the executable is `dsh-console`.

DSH owns agent execution, sessions, models, attachments, tools, persistence, credentials, providers, and canonical events. This repository owns terminal interaction, presentation, input preparation, and focused DSH-facing adapters. Build against public DSH services and canonical contracts; do not patch Harness, bypass its runtime ownership, or introduce a parallel conversation store.

The repository remains a multi-package pnpm workspace. `apps/cli` is the public package, internal workspace packages are private implementation boundaries, and unrelated work must not rename or flatten them. Use Node.js 24 or newer, pnpm 11, and workspace-level pnpm commands.

## Architecture boundaries

### DSH boundary

- Use official DSH types for sessions, events, content blocks, attachments, tools, todos, usage, approvals, and questions. Do not replace canonical contracts with permissive local shapes when an official type exists.
- Keep SDK access, compatibility adaptation, and event projection inside focused runtime adapters and projectors. React components consume stable presentation-oriented View Models rather than the full SDK surface.
- DSH persistence and canonical events are the source of truth. Do not fabricate canonical events or attachment references before DSH accepts them.
- Preserve useful generic terminal UI, but implement product capabilities through DSH-native services rather than provider-specific APIs.

### Runtime and TUI boundary

- Keep conversation, session management, model selection, input preparation, attachment admission, tool catalog, approvals, and user questions separate when their lifecycles differ.
- Session and Agent switching is transactional: prepare the candidate first, preserve the active conversation on failure, then swap and dispose the previous Agent.
- Prompt presentation may preserve the user's original input, while canonical content must exactly match what DSH admitted.
- Unknown extension blocks use a registered renderer or a safe fallback; they must not crash the terminal or silently lose data.
- Keep alternate-screen restoration, terminal resize, working/idle state, cancellation, and process exit explicit and testable.

## TUI behavior contracts

- Reuse the established React/Ink visual language and generic Command/Dialog infrastructure. Prefer a dedicated dialog when a command needs browsing, configuration, or richer keyboard interaction.
- Shell mode executes in the local terminal and never submits a model prompt.
- During local input preparation, `Ctrl+C` aborts preparation and restores the prompt without creating a turn. During an active DSH turn it cancels that turn; while idle it exits and restores the terminal.
- Orca-specific behavior is outside the default scope unless the task explicitly requires Orca validation or integration.

## DSH compatibility matrix

- Treat compatibility as two explicit endpoints: the minimum published npm version in `dsh.compatibility.minimum`, and the maximum audited source version in `dsh.compatibility.maximumTested` and `scripts/dsh-source-target.json`.
- DSH-facing production code, canonical type usage, fixtures, integration probes, and package metadata must remain valid at both endpoints. Keep version adaptation at focused DSH boundaries instead of spreading checks through UI code.
- Before relying on local results, run `pnpm run check:dsh-minimum` or `pnpm run check:dsh-maximum`. A Harness source link proves only the maximum endpoint; `pnpm install --frozen-lockfile` alone does not prove that an existing explicit link was replaced.
- Validate the minimum endpoint in an isolated checkout installed from the frozen lockfile. Validate the maximum endpoint from the immutable audited Harness commit.
- Do not commit or synchronize a DSH compatibility change until both applicable endpoint gates succeed. A skipped, interrupted, or single-endpoint run is partial validation and must be reported as such.

## Verification and delivery

Use the smallest relevant checks while iterating:

```sh
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run build:cli
pnpm run test:ci
pnpm run test:integration:dsh
pnpm run test:package
```

`format:check` checks only changed files without rewriting the working tree.

The minimum endpoint gate includes format, lint, typecheck, CLI build, workspace tests, DSH composition, and packaged installation. The maximum endpoint gate includes typecheck, CLI build, workspace tests, and DSH composition after selecting the audited source runtime. Package or launcher changes require the packaged installation gate; terminal lifecycle changes require the relevant PTY coverage.

Keep changes cohesive and independently buildable. Avoid unrelated cleanup, broad mechanical renames, or deleting useful UI before identifying its DSH-native replacement. Preserve Apache-2.0 licensing, accurate notices, and a public tarball limited to the launcher, runtime output, bundle metadata, documentation, license, and notices. Never commit credentials, private endpoints, personal paths, generated local state, or private development material.

Local commits are allowed after the applicable gates pass. Follow the repository workflow for remote operations; do not create tags, publish packages, rewrite public history, modify remotes, or perform other release actions without explicit user authorization.

## Documentation discipline

- Keep Markdown prose paragraphs on one physical line.
- Keep shared installation, requirements, maturity, and user-facing behavior synchronized between `README.md` and `README.zh.md`. Package documentation and Agent Notes remain English-only unless their audience changes explicitly.
- Record durable architecture, compatibility, release, product-contract, and simplification decisions under `.agents/notes/`; follow `.agents/notes/README.md` for lifecycle and structure.
- Search active `proposed/` and `implemented/` notes before changing a documented area. Do not treat frozen `archived/` notes as current authority.
