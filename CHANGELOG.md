# Changelog

All notable user-facing changes to DSH Console are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-rc.2] - 2026-10-09

### Changed

- Upgrade the documentation framework to the compatible Starlight `0.42.6` and Astro `7.2.10` pair, keeping upstream type declarations and browser support policy rather than bypassing type checks.
- Advance the published DSH baseline, exact runtime peers, and audited source endpoint to `0.2.1-alpha.2` at immutable release commit `d743267388641bc76f17c45ce8b4c231aed1d32c`.
- Package the official alpha.2 preset resources unchanged, preserving Harness-owned managed subagent activations, working-directory context, and native or PTC tool policy.
- Use the audited Harness checkout's declared pnpm version for source-endpoint CI and synchronize prerelease maturity and pinned installation documentation.

### Fixed

- Project nested PTC tool calls and results through the same presenter as native tools, preserving metadata, structured failures, replay, and outcome metrics.
- Keep external subagent executions visible in the Agent catalog and identify their unavailable local Session history without querying or synthesizing a Session.

### Fixed

- Refresh vulnerable runtime and tooling transitive dependencies within their declared ranges and advance documentation image processing and deployment tooling to patched `sharp` and Wrangler releases without adding DSH dependency overrides.

## [0.1.0-rc.1] - 2026-10-03

### Changed

- Begin the Console release-candidate series with one shared version policy for local integration, candidate checks, and npm publication; stable and unknown release channels remain rejected.
- Upgrade the published DSH baseline and audited source endpoint to `0.2.1-alpha.1` at immutable release commit `5badb15009ae1756c3afe0ae0cef1faafc290ccc`, including explicit peer support for its Cordis, Loader, and Schemastery prereleases.
- Package the new official preset resources unchanged, including time context, preset-scoped scheduling tools, and the upstream restrictions on delegated scheduling.
- Keep Profile resolution, preset composition, Session persistence, and Goal scheduling with their DSH owners rather than duplicating upstream lifecycle or migration behavior in Console.
- Synchronize pinned installation examples and compatibility diagnostics in the English and Chinese documentation.

## [0.1.0-alpha.21] - 2026-10-02

### Added

- Select an existing DSH profile with `--profile` or `DSH_CONSOLE_PROFILE`, while keeping the managed `dsh-console` profile as the default.

### Changed

- Reconcile only the Console bundle through DSH's public plugin manager in the selected profile; preserve its other bundles and user patch.

## [0.1.0-alpha.20] - 2026-10-02

### Changed

- Advance compatibility to the published DeepSeek Harness `0.2.0-rc.2` release, audited at commit `639ed015397290b3745d163aafe02ffee4aa3f84`.
- Update exact development dependencies, public peer requirements, the immutable source target, and installation documentation to the new audited baseline.
- Keep Session repair, projection, query, and Agent preset policy with DSH public services; no Console-side recovery implementation or speculative deprecated-API migration is introduced.

### Fixed

- Raise the direct `undici` floor to `7.29.1`, upgrade documentation-only Wrangler to a release with patched Miniflare/Undici, and refresh vulnerable `fast-uri` and `ip-address` transitives within upstream-declared ranges without dependency overrides.

## [0.1.0-alpha.19] - 2026-09-27

### Changed

- Advance the audited DeepSeek Harness baseline to `0.1.7-rc.2` at immutable release commit `477b4f420553e8a52c2fbccc464d7561b239c443`, keeping public Host peers and bundled preset resources on the same published release.
- Follow the rc.2 public Agent preset roster without recreating its removed mode-selection switch; Harness remains responsible for effective defaults and selection validity.

## [0.1.0-alpha.18] - 2026-09-24

### Changed

- Advance the audited DeepSeek Harness baseline to `0.1.7-rc.1` at immutable release commit `a60af51e809d008d89af3ade60ee107547b175bf`.
- Use the public declarative Agent preset registry and package the exported Harness preset resources unchanged, preserving Host-owned selection and composition policy.
- Consume Session format 4 tool-role results and header-only projection-cache reads through public DSH APIs; persistence and historical migration remain Harness-owned.
- Follow the Session-ID-based Job registry and its public lifecycle event stream without consuming model-owned output.

### Fixed

- Recheck live Harness preset policy before selection and deferred Session creation, cancel closed picker requests, reject cross-Session selection races, and verify exported preset resources in the installed package rather than only the build directory.

## [0.1.0-alpha.17] - 2026-09-18

### Added

- Validate the exact `dsh` executable selected from `PATH` against package compatibility metadata before profile changes, with actionable missing, old, invalid, and failed-version diagnostics plus a non-blocking warning for newer unaudited releases.

### Changed

- Pin installation documentation to the audited DSH and Console prerelease pair and mechanically check those examples against the public package manifest.
- Advance the audited DeepSeek Harness baseline to `0.1.6-alpha.2` at immutable release commit `6b1808f432adfa96ab6c2f033e158ca230422e16`, retaining Host ownership of model modality, Plan review identity, and Subagent capacity policy.

## [0.1.0-alpha.16] - 2026-09-15

### Changed

- Require DeepSeek Harness `0.1.6-alpha.1` from its audited immutable release commit, follow the Host-owned Agent preset selection policy through the public roster API, and retire pre-format-3 Session compatibility fallbacks.

## [0.1.0-alpha.15] - 2026-09-12

### Added

- Add a DSH-native workspace Session explorer with title and conversation search, previews, rename, resume, and persistent fork actions.
- Add `/jobs` and `/goals` dialogs backed by the public DSH Job Registry and Goal Service, with compact activity status in the footer.

### Changed

- Keep Session search startup lazy through DSH's durable query index and show a stable first page while search work is pending.
- Let DSH own native `/goal` commands and Goal tool presentation while Console provides only the `/goals` visual management surface.
- Document the product boundary that Console must consume public DSH capabilities instead of scanning raw Session logs or maintaining shadow lifecycle state.

### Fixed

- Close dialogs consistently with either `Esc` or `Ctrl+C`.
- Avoid listing projection-confirmed empty Sessions and prevent Session detail loading from remaining stuck after an empty preview or canceled action.
- Preserve transactional Session switching and avoid consuming or reconstructing DSH-owned background Job output.

## [0.1.0-alpha.14] - 2026-09-12

### Added

- Add per-Session DSH Agent preset discovery, selection, restoration, and descriptive `/preset` completion with Main and Side composition inheritance.
- Add `/skills`, Skill slash completion, and user-invocable Skill routing through the ordinary DSH prompt path, with source labels that distinguish Skills from ordinary commands.
- Add image attachment submission for DSH commands that advertise attachment support.

### Changed

- Expand audited DeepSeek Harness compatibility from `0.1.5-rc.1` through `0.1.5-rc.2`.

### Fixed

- Keep slash-command prefix suggestions responsive while typing, then expand them with fuzzy matches when available.

## [0.1.0-alpha.13] - 2026-09-11

### Changed

- Require DeepSeek Harness `0.1.5-rc.1`, use its canonical live and durable Assistant stream contracts directly, and retire the pre-v2 `assistant/chunk` compatibility path.
- Follow Harness's `deepseek-flash` (`DeepSeek-V4.1-Flash`) new-session default and its declared text, image, and in-history system-prompt capabilities without copying model aliases or catalog policy into Console.

### Security

- Update Astro and Sharp and enforce patched Hono, js-yaml, Sharp, and smol-toml transitive versions to remediate dependency advisories.

## [0.1.0-alpha.12] - 2026-09-08

### Added

- Add a DSH-native Plan mode indicator and `Shift+Tab` toggle that preserves the selected permission preset, including deployment-configured presets.

### Changed

- Verify the Console host through DeepSeek Harness `0.1.3-alpha.2`, adapting live and durable Assistant streams across Session format v2 while retaining the npm-default `0.1.1-rc.2` development baseline.

## [0.1.0-alpha.11] - 2026-09-04

### Added

- Add mouse-interactive startup actions, responsive Pokémon shuffling, and a packaged, read-only `/changelog` viewer while preserving keyboard-first navigation.
- Simplify settings, theme, and editor dialogs to save user preferences directly without exposing configuration scopes.

### Changed

- Consolidate interactive Session continuation under `/sessions`; direct startup continuation remains available through `--resume <session-id>`.
- Verify the Console host through DeepSeek Harness `0.1.2-rc.1`, including its Session persistence, projection-cache, subagent continuation, and profile-level proxy changes, while retaining the npm-default `0.1.1-rc.2` development baseline.

### Fixed

- Make terminal hover work on the first passive mouse movement through demand-driven any-motion tracking, while preserving click handling, modal priority, native-selection guidance, and complete terminal cleanup.

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

[Unreleased]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.19...HEAD
[0.1.0-alpha.19]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.18...v0.1.0-alpha.19
[0.1.0-alpha.18]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.17...v0.1.0-alpha.18
[0.1.0-alpha.17]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.16...v0.1.0-alpha.17
[0.1.0-alpha.16]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.15...v0.1.0-alpha.16
[0.1.0-alpha.15]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.14...v0.1.0-alpha.15
[0.1.0-alpha.14]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.13...v0.1.0-alpha.14
[0.1.0-alpha.13]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.12...v0.1.0-alpha.13
[0.1.0-alpha.12]: https://github.com/cofy-x/dsh-console/compare/v0.1.0-alpha.11...v0.1.0-alpha.12
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
