---
title: Quick Start
description: Install DSH Console, configure the first provider credential, and submit a prompt.
---

DSH Console requires Node.js 24 or newer and a working terminal. Install DeepSeek Harness and the Console from npm:

```sh
npm install --global @deepseek-ai/dsh @cofy-x/dsh-console
dsh-console
```

The launcher initializes or locates the `dsh-console` DSH profile and opens the interactive TUI. If the selected DeepSeek provider has no credential, the Console opens a masked setup dialog before it submits the first prompt.

You can also start with a prompt:

```sh
dsh-console --prompt "Explain this repository"
```

Continue the latest resumable Session for the current directory, or resume an exact Session ID before submitting an optional initial prompt:

```sh
dsh-console --continue
dsh-console --resume dsh-console-01234567-89ab-cdef-0123-456789abcdef --prompt "Continue this work"
```

The credential is written through the DSH credential service. DSH Console does not keep a separate authentication store and never writes a credential into a prompt or Session event.

## First interaction

Type a prompt and press Enter. Assistant text streams into the transcript while reasoning, tools, todo state, attachments, and usage are projected into their dedicated TUI surfaces.

Type `/` to discover built-in Console commands and commands supplied by the active DSH profile. DSH commands such as `/plan` are available before the first prompt without creating an empty persisted Session.

During a running turn, `Ctrl+C` cancels the DSH operation. While idle, `Ctrl+C` disposes the runtime, restores the terminal, and exits.

## Isolated environments

`DSH_HOME` controls the active profiles, JSONL Session logs, credentials, and attachment objects. Use an isolated value when testing:

```sh
DSH_HOME=/tmp/dsh-console-home dsh-console --prompt "hello"
```

Next, learn how to [select a model and reasoning effort](/guides/models/), [resume a persisted Session](/guides/sessions/), or [review an agent plan](/guides/workflows/).
