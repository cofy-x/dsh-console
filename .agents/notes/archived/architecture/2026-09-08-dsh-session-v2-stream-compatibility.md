# DSH Session v2 stream compatibility

## Status

Implemented.

## Context

DeepSeek Harness `0.1.3-alpha.1` replaces durable `assistant/chunk` Session events with process-local `agent/assistant-stream` frames and embeds each settled attempt's compact stream in `assistant/message` or `assistant/attempt`. DSH Console still supports the published `0.1.1-rc.2` minimum, whose live and durable stream is represented by `assistant/chunk` events.

## Decision

The DSH adapter accepts both representations and projects them into one Console conversation model. Legacy chunk recognition, v2 frame subscription, and compact-stream timing access live in `assistant-stream-compat.ts`. UI components remain independent of DSH format versions. Live v2 frames provide incremental text, reasoning, usage, and first-token timing; the adapter accepts their monotone revisions and dense attempt-local indexes before the final canonical Session event reconciles displayed content and metrics. Failed committed attempts and abandoned attempts remove their transient output, while retry usage remains independently accounted. Durable v2 message and attempt streams restore timing during replay without recreating transient UI deltas. Prompt completion reads only the final canonical Assistant message because it awaits Agent idle.

## Alternatives

Requiring only DSH `0.1.3-alpha.1` would remove the compatibility adapter but prematurely drop the published minimum. Continuing to read only Session events would preserve old DSH support but lose live output on v2. Branching throughout UI projectors would couple presentation code to persistence versions.

## Consequences

The compatibility logic remains temporary and localized. Failed or replaced v2 attempts remove their transient Assistant output, while committed attempts converge on the canonical message. The minimum dependency graph stays frozen at `0.1.1-rc.2`; only the audited source endpoint and peer upper bounds advance.

## Verification

Unit tests cover legacy chunks, v2 live-frame reconciliation, abandoned attempts, embedded-stream timing, and canonical prompt completion. `pnpm run check:dsh-minimum` and `pnpm run check:dsh-maximum` verify the complete declared endpoint matrix.
