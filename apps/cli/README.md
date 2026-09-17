# DSH Console

`dsh-console` is a TypeScript and React/Ink terminal frontend for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness).

> DSH Console is currently a public alpha. Commands and UI details may change before the first stable release.

## Install

DSH Console requires Node.js 24 or newer, supports DeepSeek Harness `0.1.6-alpha.2` through the maximum tested version `0.1.6-alpha.2`, and needs a working DSH provider configuration. Console follows audited DSH releases; the compatible prerelease can differ from npm `latest`, so install the exact audited pair:

```sh
npm install --global @deepseek-ai/dsh@0.1.6-alpha.2 @cofy-x/dsh-console@0.1.0-alpha.17
dsh-console --prompt "hello"
```

The launcher resolves the actual `dsh` executable on `PATH` and validates its version before changing the Console profile. Check it with `dsh --version` and `command -v dsh` on macOS/Linux, `(Get-Command dsh).Source` in PowerShell, or `where dsh` in Command Prompt. Older DSH releases are blocked with the exact repair command; newer unaudited releases receive a non-blocking warning.

Public Alpha releases retain prerelease versions while the current published Console remains available through npm's default install path. The published launcher reconciles its package into the DSH profile; `pnpm start` from a source checkout resolves that checkout and is a separate development path.

## Use

The launcher initializes its owned `dsh-console` DSH profile, aligns the profile package with the launcher version, and starts an interactive terminal session. It can continue persisted work before the TUI starts:

```sh
dsh-console --continue
dsh-console --resume dsh-console-01234567-89ab-cdef-0123-456789abcdef --prompt "continue this work"
```

Startup continuation is scoped to persisted Console conversations and their persistent forks in the current directory. Useful interactive commands include:

```text
/model       Select the active DSH model
/new         Start a fresh conversation
/sessions    Search, preview, rename, resume, or fork workspace Sessions
/jobs        Inspect and stop background jobs for the interactive Session
/goals       Inspect and manage the Session goal and its round limit
/tools       Inspect tools exposed by the active DSH agent
/skills      Inspect user-invocable Skills for the active DSH agent
/preset      Show or change the blank Session's DSH Agent preset
/permission  Select the active DSH permission preset
/theme       Select the terminal theme
/settings    Edit Console settings
```

DSH owns provider credentials, model routing, session logs, and attachments. DSH Console does not maintain a separate authentication or session database.

In `/sessions`, press `/` to search and Enter to preview a Session. Forking offers completed Turn boundaries, preserves the source composition and model route, and creates a durable conversation without changing files. `/jobs` never consumes the Agent's output cursor; output remains in DSH's `job_output` flow. `/goals` distinguishes durable phase from process-local activation: restored goals remain disarmed until you explicitly resume them. Native `/goal ...` commands and their attachment support remain available.

Full-text search opens a DSH-managed, rebuildable SQLite index under `DSH_HOME` on the first search, not at startup. Session logs remain the durable source of truth. A user profile that explicitly disables the DSH search provider keeps that override.

See the [GitHub repository](https://github.com/cofy-x/dsh-console) for source development, architecture, alpha boundaries, and license attribution details.
