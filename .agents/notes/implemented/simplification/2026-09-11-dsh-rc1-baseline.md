# DSH 0.1.5-rc.1 Baseline

## Status

Implemented.

## Context

Console previously retained the npm-default DSH `0.1.1-rc.2` as its minimum while auditing newer source releases as a separate maximum. That span required local copies of pre-v2 and v2 Assistant stream contracts, runtime type assertions, and projection branches for the removed durable `assistant/chunk` event.

## Decision

Console requires DSH `0.1.5-rc.1` as both its registry baseline and audited source version. Runtime peers use the exact release while those endpoints coincide. Console consumes `AssistantStreamFrame`, `SessionEvent`, and durable embedded streams from official DSH types and no longer recognizes pre-v2 `assistant/chunk` events.

The public peer list remains limited to host services that Console consumes directly. Package-install validation expands those peers through the installed DSH runtime dependency graph, requires every package in that closure to use the same exact baseline, installs the complete closure from the registry, and rejects a mixed npm dependency tree.

Harness remains the source of truth for model catalog and default-selection policy. Console reads the current selection, model list, resolved capabilities, and input modalities at runtime, so the `deepseek-flash` default and its text, image, and in-history system-prompt capabilities require no Console-owned alias or model table.

The registry and source gates remain distinct provenance checks. A later audited release may advance the source endpoint and temporarily restore a version range, but production code must not duplicate DSH contracts or add version branches without a concrete supported endpoint that requires them.

## Alternatives

Keeping `0.1.1-rc.2` would preserve a wider nominal range but retain untyped compatibility code for an obsolete event model. Removing source verification would simplify the scripts but lose evidence that the published baseline and reviewed Harness source expose the same contracts.

## Consequences

Installations must use DSH `0.1.5-rc.1` with the matching Cordis, loader, and Schemastery baselines required by that release. Live output uses `agent/assistant-stream`; replay and timing use the embedded stream on canonical `assistant/message` and `assistant/attempt` events. Session format migration remains DSH-owned, so Console projects only the current `SessionEvent` union.

## Verification

Registry and audited-source gates each run type checking, the CLI build, workspace tests, and the DSH composition probe. The registry gate also verifies packaged installation. Projector tests cover live reconciliation, abandoned and retried attempts, canonical replay, usage accounting, and durable first-token timing without pre-v2 events.
