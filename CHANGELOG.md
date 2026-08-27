# Changelog

All notable user-facing changes to DSH Console are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.4...HEAD
[0.1.0-alpha.4]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.2...v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.1...v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/cofy-x/dsh-console/releases/tag/v0.1.0-alpha.1
