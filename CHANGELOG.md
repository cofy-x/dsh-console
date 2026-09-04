# Changelog

All notable user-facing changes to DSH Console are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-alpha.11] - 2026-09-04

### Added

- Add mouse-interactive startup actions, responsive Pokémon shuffling, and a packaged, read-only `/changelog` viewer while preserving keyboard-first navigation.
- Simplify settings, theme, and editor dialogs to save user preferences directly without exposing configuration scopes.

### Changed

- Consolidate interactive Session continuation under `/sessions`; direct startup continuation remains available through `--resume <session-id>`.
- Verify the Console host through DeepSeek Harness `0.1.2-rc.1`, including its Session persistence, projection-cache, subagent continuation, and profile-level proxy changes, while retaining the npm-default `0.1.1-rc.2` development baseline.

## [0.1.0-alpha.10] - 2026-09-02

### Added

- Show canonical per-turn duration, output speed, and first-token latency beneath completed responses, with whole-session timing details available through `/stats`.

### Changed

- Verify the Console host through DeepSeek Harness `0.1.2-alpha.4`, including its branded Session sequence and log-offset contracts, while retaining the npm-default `0.1.1-rc.2` development baseline.

## [0.1.0-alpha.9] - 2026-09-01

### Changed

- Verify the Console host through DeepSeek Harness `0.1.2-alpha.3` while retaining the npm-default `0.1.1-rc.2` development baseline.
- Keep the launcher-owned DSH profile package aligned with the exact installed Console version while preserving explicit source and package overrides.
- Type-check CLI tests, development scripts, and documentation through the standard workspace quality gate.

## [0.1.0-alpha.8] - 2026-08-31

### Changed

- Verify the Console host through DeepSeek Harness `0.1.2-alpha.2`, including its Session event compatibility, projection ownership, and runtime dependency changes.

## [0.1.0-alpha.7] - 2026-08-30

### Changed

- Require DeepSeek Harness `0.1.2-alpha.1` across the Console host boundary and align the canonical tool-call identity with `ToolCallId`.
- Verify npm's default dist-tag resolves to the exact released Console version.

### Fixed

- Keep DSH, Cordis, Session, Commands, and tool services host-provided through optional peers instead of installing duplicate runtime instances.

## [0.1.0-alpha.6] - 2026-08-29

### Added

- Add `--continue` and `--resume <session-id>` startup continuation, including atomic resume-before-prompt behavior.
- Add a DSH-native Plan Review dialog with Markdown plan presentation, canonical approval choices, and free-text change requests.

### Changed

- Prepare the DSH adapter for the scoped user-question waterfall while retaining compatibility with the currently published provider registration contract.
- Follow canonical `@deepseek-ai/dsh-tool-todo` ownership for todo events and projections.
- Keep Tool Card headers compact while allowing genuinely truncated titles and shell commands to expand in place for full inspection.

### Fixed

- Discover and execute DSH slash commands such as `/plan` before the first prompt without creating an idle startup Session.

## [0.1.0-alpha.5] - 2026-08-28

### Added

- Add `/btw` for a temporary, multi-turn Side conversation that can run alongside the Main Agent and switch with `Ctrl+/`.
- Add deterministic startup header selection with `--pokemon <number>` and the `DSH_CONSOLE_POKEMON` environment variable.
- Add a DSH-native `/agents` catalog with nested delegation state, live running-Agent status, and canonical read-only subagent history.

### Changed

- Keep workspace, active conversation, model, and context details legible in compact Footer layouts.
- Clarify idle Todo state by presenting canonical unfinished items without implying that work is still running.

### Fixed

- Materialize the main DSH Agent only when the first prompt is submitted, so opening, configuring, or leaving an unused Console no longer creates persistent empty Sessions.

## [0.1.0-alpha.4] - 2026-08-27

### Added

- Show canonical model context capacities in the model selector and the latest prompt usage next to the active model in the footer, with compact and threshold-aware presentation.
- Expand `/stats` and the shared exit summary with canonical prompt, cache, output, reasoning, context occupancy, and session totals, including a narrow-terminal layout.
- Add DSH-native reasoning effort selection as the second step of the model dialog, preserve it across Agent creation and Session resume, and show the active choice in the footer.

### Fixed

- Align TypeScript project boundaries so clean workspace builds and standalone editor diagnostics resolve generated declarations, Node.js types, Vitest globals, and test configuration correctly.

### Removed

- Remove the invasive `/terminal-setup` command that modified global IDE keybindings; terminal behavior remains capability-driven.

## [0.1.0-alpha.3] - 2026-08-25

### Added

- Add the Pokefetch-derived Pokemon header art pack and attribution for the interactive startup experience.

## [0.1.0-alpha.2] - 2026-08-25

### Changed

- Refine model selection into a dialog-only workflow and remove argument completion for legacy model subcommands.
- Derive the displayed and tested CLI version from the public package manifest so release version checks cannot drift from package metadata.

## [0.1.0-alpha.1] - 2026-08-25

### Added

- Publish the first DSH-native public alpha with streaming multi-turn conversations, model selection, session resume, image attachments, tool and todo presentation, prompt completion, permission controls, and debug diagnostics.
- Add first-run provider credential setup backed by DSH credential services.
- Add npm publication, release checks, CodeQL analysis, and public alpha documentation.

### Changed

- Standardize the development and release toolchain on Node.js 24, pnpm 11, ESLint 10, and the current Vite and Vitest stack.

### Fixed

- Keep debug diagnostics aligned within the existing footer row and preserve structured logs in the debug console.
- Address initial CodeQL findings, dependency advisories, CI concurrency issues, and release build ordering.

[Unreleased]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.11...HEAD
[0.1.0-alpha.11]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.10...v0.1.0-alpha.11
[0.1.0-alpha.10]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.9...v0.1.0-alpha.10
[0.1.0-alpha.9]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.8...v0.1.0-alpha.9
[0.1.0-alpha.8]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.7...v0.1.0-alpha.8
[0.1.0-alpha.7]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.6...v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/cofy-x/dsh-console/releases/tag/v0.1.0-alpha.1
