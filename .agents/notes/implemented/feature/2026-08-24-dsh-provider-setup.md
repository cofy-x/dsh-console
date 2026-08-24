# DSH-native provider setup

**Status:** Implemented

## Context

DSH Console must help a first-time user reach a working model request without creating its own provider authentication or credential store. DSH already owns configurable provider discovery, settings, credential references, layered credential resolution, and durable writes.

## Decision

DSH Console presents provider setup through a dedicated runtime and masked dialog. The DSH adapter discovers the selected configurable provider, derives the DeepSeek credential reference from the active DSH settings descriptor, checks it with `credentials.describe()`, and writes it only with `credentials.set()`. The TUI never resolves or displays an existing secret.

The current alpha implements writable API-key setup for the official DeepSeek provider while keeping the UI contract provider-neutral. A missing current credential opens setup before the first prompt is submitted. Cancelling setup restores an automatic initial prompt to the composer without creating a DSH turn. The same setup dialog is available when selecting a model whose provider is missing its credential.

Secret input uses isolated component state and activates process-wide sensitive-input protection while mounted. Raw stdin and complete parsed-key diagnostics remain available outside credential dialogs; while sensitive input is active, both log paths emit only redacted event metadata and lengths. Secret values are never sent to prompt history, session events, telemetry, the normal input buffer, or diagnostic logs.

## Alternatives

Requiring `DEEPSEEK_API_KEY` in the shell was rejected because it gives first-time users no interactive recovery and assumes every provider uses environment API keys. Writing `.env` or `.credentials.yaml` directly was rejected because it bypasses DSH ownership, layering, permissions, and future credential providers. Reusing the normal prompt input was rejected because it could expose a secret through history and logging paths.

## Consequences

Credentials written to DSH managed storage affect the next model operation without restarting. Credentials supplied by a read-only environment source cannot be overwritten from the dialog. Providers whose setup contract is not yet adapted remain usable through their existing DSH configuration path and are reported as unsupported by the Console setup runtime rather than guessed.

## Verification

Runtime tests cover settings-derived credential references, DSH-managed writes, current snapshot publication, and unsupported providers. UI and integration checks must verify masked entry, cancellation, first-prompt gating, `/model` setup, and absence of secret values from logs and Session events.
