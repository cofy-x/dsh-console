# DSH Console

`dsh-console` is a TypeScript and React/Ink terminal frontend for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness).

> DSH Console is currently a public alpha. Commands and UI details may change before the first stable release.

## Install

DSH Console requires Node.js 24 or newer, supports DeepSeek Harness `0.1.5-rc.1` through `0.1.5-rc.2`, and needs a working DSH provider configuration. This release is verified against both compatibility endpoints; install DSH normally without pinning the command to a version.

```sh
npm install --global @deepseek-ai/dsh @cofy-x/dsh-console
dsh-console --prompt "hello"
```

Public Alpha releases retain prerelease versions while the current published Console remains available through npm's default install path.

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
