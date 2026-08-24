# DSH Console

DSH Console is a TypeScript and React/Ink terminal frontend for
[DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness). It keeps
terminal interaction and presentation in the client while using DSH as the
canonical runtime for agents, models, sessions, tools, approvals, and
attachments.

> [!WARNING]
> DSH Console is currently a public alpha. Its DSH contracts and persisted
> sessions are real, but commands and UI details may still change before the
> first stable release.

## Current capabilities

- Streaming, multi-turn conversations with Markdown and reasoning display
- DSH-native model selection through `/model`
- Image input from `@path` references and the system clipboard
- DSH tool calls, results, approvals, questions, and `/tools`
- DSH-backed session persistence, `/new`, `/sessions`, and `/resume`
- Prompt completion through an isolated DSH agent/session
- Shell mode with `!command`, themes, settings, and terminal-safe cleanup
- Continued operation in a regular PTY or an embedded terminal such as Orca

## Requirements

- Node.js 24 or newer
- pnpm 11 for development from source
- A working DSH installation and provider configuration

Provider credentials, model routing, session logs, and attachment objects are
owned by DSH. DSH Console does not add a separate authentication or provider
storage layer.

## Run from source

```sh
pnpm install --frozen-lockfile
pnpm run build:cli
pnpm start -- --prompt "hello"
```

Running `pnpm start` launches the same `dsh-console` entry point exposed by the
published package. The launcher initializes or locates the `dsh-console` DSH
profile before starting the interactive UI.

Once the public package is available, the intended installation is:

```sh
npm install --global @deepseek-ai/dsh @cofy-x/dsh-console@alpha
dsh-console --prompt "hello"
```

Alpha releases use the `alpha` npm dist-tag and never update `latest`.

## Sessions and local data

DSH is the source of truth for session history. DSH Console lists resumable
top-level `dsh-console-*` sessions for the current working directory and
replays their canonical DSH event surface. It does not maintain a parallel
client-owned session database.

The active DSH home controls where profiles, JSONL session logs, and attachment
objects are stored. Set `DSH_HOME` to isolate an environment:

```sh
DSH_HOME=/tmp/dsh-console-home pnpm start -- --prompt "hello"
```

Useful interactive commands include:

```text
/model       Select the active DSH model
/new         Start a fresh conversation
/sessions    Browse resumable sessions for the current directory
/resume      Browse sessions, or resume a full session ID
/tools       Inspect tools exposed by the active DSH agent
/theme       Select the terminal theme
/settings    Edit Console settings
```

During a turn, `Ctrl+C` cancels the active DSH operation. While idle, `Ctrl+C`
disposes the runtime, restores the terminal, and exits.

## Architecture

- DSH canonical types and services are used at the runtime boundary.
- Console-specific view models isolate React components from the complete DSH
  event schema.
- Session replay and live streaming share the same event projector.
- Images are admitted through the DSH attachment service before a user turn is
  created; failed admission never degrades silently to text-only input.
- Prompt completion uses a separate temporary agent/session and never writes to
  the active conversation.

The distributable package includes the launcher, compiled Console runtime, DSH
plugin bundle, license, and attribution notices. DSH runtime plugins remain
peer-provided by the selected profile.

## Alpha boundaries

The current release intentionally does not provide cross-directory session
search, session rename/delete/fork, generic file/PDF/audio/video attachments,
native terminal image protocols, a web UI, or a standalone provider/auth layer.

## Development

```sh
pnpm run lint
pnpm run typecheck
pnpm run build:cli
pnpm run test:ci
pnpm run test:integration:dsh
pnpm run test:package
```

`test:integration:dsh` composes the real Cordis/DSH runtime with a deterministic
fake LLM adapter. `test:package` packs the public package, installs it in an
isolated directory, initializes an isolated `DSH_HOME`, and exercises the
installed launcher.

## License and attribution

DSH Console is licensed under the Apache License 2.0. See [LICENSE](LICENSE),
[NOTICE](NOTICE), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Portions
of the terminal UI and supporting utilities are derived from Gemini CLI and
retain their original copyright notices.
