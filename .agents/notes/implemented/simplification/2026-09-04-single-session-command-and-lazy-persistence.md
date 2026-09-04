# Single Session command and lazy persistence

## Status

Implemented on 2026-09-04.

## Context

`/sessions` and `/resume` opened the same interactive Session browser, while opening and immediately closing older Console versions left setup-only Session records that accumulated in history.

## Decision

Use `/sessions` as the sole interactive Session continuation command, retain `--resume <session-id>` as the explicit startup interface, and keep a new conversation pending until meaningful work materializes its DSH Agent and Session.

## Alternatives

Keeping both slash commands preserves an alias but duplicates the same interaction, while scanning every Session log in the browser could hide setup-only records but would make listing latency scale with complete history.

## Consequences

The command surface is smaller, opening and exiting the TUI does not persist an idle Session, and the Session browser remains metadata-only and fast; historical setup-only records require one-time out-of-band backend maintenance because DSH intentionally exposes no deletion API.

## Verification

Verify the built-in command inventory and Session command tests, run the CLI typecheck and build, and confirm that starting and exiting without a submission leaves the persisted Session count unchanged.
