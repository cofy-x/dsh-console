# Canonical Tool and Subagent Projections

## Status

Implemented.

## Context

DSH exposes nested PTC dispatches as durable tool events with the same result content, presentation metadata, and structured failure vocabulary as native calls. Its descendant catalog also includes external executions whose opaque child identity does not identify a local DSH Session.

## Decision

Console projects native calls and nested PTC dispatches through shared tool-call and tool-result operations. It pairs each dispatch using its canonical call id, serializes the recorded arguments for presentation, and forwards recorded metadata to the existing Host tool presenter. Live and replay reads use the same projector. Tool execution, metadata production, and result persistence remain DSH-owned.

The Agent catalog preserves the public descendant mode and activity. An external execution remains visible but offers no local Session transcript. The runtime rejects that read before calling Session query, and the dialog explains availability without creating a local Session or inferring external lifecycle state. Catalog refreshes follow public catalog, descriptor, and subagent lifecycle notifications.

Original project identity continues to come from the Session header. DSH owns the mutable working directory, subagent activation, completion delivery, and official preset policy. Console packages the audited public preset resources unchanged instead of retaining removed delegation configuration or introducing provider-specific execution paths.

## Alternatives

A separate PTC renderer would duplicate tool metadata and failure semantics. Reading external provider logs or inventing a local Session would extend Console beyond the public DSH capability. Hiding external catalog entries would discard supported discovery information.

## Consequences

The same canonical tool outcomes have the same display in live conversations and restored history. Nested dispatches contribute to Console tool outcome metrics, and cancellation suppresses later dispatch updates for the cancelled turn. Historical one-shot and current continuable entries remain readable through DSH's supported catalog; external entries explicitly report transcript availability.

## Verification

Projector tests cover PTC metadata during live and replay projection, structured failures, outcome counts, cancellation, and ignorable plugin records. Catalog and dialog tests cover visible external entries and rejection before Session query. Registry and immutable-source compatibility gates additionally check types, CLI build, workspace tests, DSH composition, and packaged installation.
