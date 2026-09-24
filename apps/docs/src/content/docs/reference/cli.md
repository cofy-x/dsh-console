---
title: CLI and Environment
description: DSH Console startup options, environment isolation, and deterministic launch settings.
---

## Startup options

| Option                  | Purpose                                                           |
| :---------------------- | :---------------------------------------------------------------- |
| `-p, --prompt <text>`   | Submit an initial prompt after startup                            |
| `-c, --continue`        | Resume the latest eligible Main Session for the current directory |
| `--resume <session-id>` | Resume an exact eligible Main Session for the current directory   |
| `--pokemon <number>`    | Select bundled Pokemon startup art for this launch                |
| `-d, --debug`           | Enable diagnostics and the debug-only `/profiler` command         |
| `-h, --help`            | Show CLI help                                                     |

`--continue` and `--resume` are mutually exclusive. Either can be combined with `--prompt`; Console completes the transactional resume before it submits that prompt.

```sh
dsh-console --continue --prompt "Summarize where we stopped"
dsh-console --resume dsh-console-01234567-89ab-cdef-0123-456789abcdef
dsh-console --pokemon 25
```

## Environment

| Variable              | Purpose                                                                      |
| :-------------------- | :--------------------------------------------------------------------------- |
| `DSH_HOME`            | Select DSH profiles, credentials, JSONL Session logs, and attachment storage |
| `DSH_CONSOLE_POKEMON` | Select default bundled Pokemon art; `--pokemon` takes precedence             |

Use a separate `DSH_HOME` for isolated testing. It changes the complete DSH environment, so Sessions and credentials from the default home are intentionally not visible.

```sh
DSH_HOME=/tmp/dsh-console-home dsh-console --prompt "hello"
```

DSH Console uses the `dsh-console` profile and the current working directory as part of its Session scope. Launching a workspace build with a different `DSH_HOME`, profile composition, or working directory can therefore show a different Session list from an installed launcher.

## DSH executable and compatibility

The launcher checks the exact `dsh` executable selected from `PATH` before profile installation or startup. This release requires DSH `0.1.7-rc.1` and is tested through `0.1.7-rc.1`. An older, missing, unexecutable, or invalid installation blocks startup; a newer release prints a non-blocking warning.

Plugin admission on newer releases is still governed by DSH compatibility checks; Console never grants version exemptions or bypasses Host restrictions.

```sh
dsh --version
command -v dsh # macOS/Linux
npm install --global @deepseek-ai/dsh@0.1.7-rc.1
```

In PowerShell use `(Get-Command dsh).Source`; in Command Prompt use `where dsh`. The compatible prerelease may differ from npm `latest`, so retain the exact version in the repair command. A published launcher resolves its installed package, while `pnpm start` in a source checkout resolves the checkout.
