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

The launcher checks the exact `dsh` executable selected from `PATH` before profile installation or startup. This release requires DSH `0.2.0-rc.2` and is tested through `0.2.0-rc.2`. An older, missing, unexecutable, or invalid installation blocks startup; a newer release prints a non-blocking warning.

Plugin admission on newer releases is still governed by DSH compatibility checks; Console never grants version exemptions or bypasses Host restrictions.

```sh
dsh --version
command -v dsh # macOS/Linux
npm install --global @deepseek-ai/dsh@0.2.0-rc.2
```

In PowerShell use `(Get-Command dsh).Source`; in Command Prompt use `where dsh`. The compatible prerelease may differ from npm `latest`, so retain the exact version in the repair command. A published launcher resolves its installed package, while `pnpm start` in a source checkout resolves the checkout.

## Select an existing DSH profile

The launcher uses its managed `dsh-console` profile by default. To use an existing DSH profile with its own provider, model, and tools, put the launcher option before Console arguments:

```sh
dsh-console --profile my-profile --prompt "hello"
```

Create the profile through DSH first, for example with `dsh plugin --profile my-profile add @cofy-x/dsh-console@0.1.0-alpha.21` (`pnpm` must be on `PATH` for DSH plugin management). The launcher updates only its Console bundle in the selected profile and forwards the remaining arguments to DSH. `--profile` takes precedence over `DSH_CONSOLE_PROFILE`, which takes precedence over the managed `dsh-console` default. A missing or invalid selected profile fails without falling back or creating it. DSH owns provider configuration, credentials, packages, and patches. Profiles in one `DSH_HOME` share Sessions, credentials, settings, and attachments; choose a different `DSH_HOME` for isolation.
