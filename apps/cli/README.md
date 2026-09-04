# DSH Console

`dsh-console` is a TypeScript and React/Ink terminal frontend for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness).

> DSH Console is currently a public alpha. Commands and UI details may change before the first stable release.

## Install

DSH Console requires Node.js 24 or newer and a working DSH provider configuration. This release is verified from the npm-default DeepSeek Harness `0.1.1-rc.2` through the current source release `0.1.2-rc.1`; install DSH normally without pinning the command to a version.

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

Startup continuation is scoped to persisted top-level Console Sessions in the current directory. Useful interactive commands include:

```text
/model       Select the active DSH model
/new         Start a fresh conversation
/sessions    Browse resumable sessions for the current directory
/tools       Inspect tools exposed by the active DSH agent
/permission  Select the active DSH permission preset
/theme       Select the terminal theme
/settings    Edit Console settings
```

DSH owns provider credentials, model routing, session logs, and attachments. DSH Console does not maintain a separate authentication or session database.

See the [GitHub repository](https://github.com/cofy-x/dsh-console) for source development, architecture, alpha boundaries, and license attribution details.
