# DSH Runtime Boundary and Console View Model

## Status

Implemented.

## Context

DSH owns canonical agents, sessions, content blocks, tool events, approvals, usage, and attachment references, while the React/Ink interface needs a stable presentation model that can evolve independently from the complete DSH SDK surface.

## Decision

Runtime adapters and session projection use official DSH canonical types at the DSH boundary. The projector translates canonical events into Console-owned view models before React components receive them. User input keeps its local display representation separate from the canonical content submitted to DSH.

Live events and replayed events pass through the same projector so streaming, resume, tool state, todo state, errors, interruption, usage, and extension blocks have one presentation path. Unknown extension blocks use registered renderers when available and a safe fallback otherwise.

## Alternatives

Passing DSH SDK objects directly into React components was rejected because it couples UI rendering to every upstream schema change. Maintaining Console-owned copies of DSH event and content types was rejected because the copies drift from the canonical runtime.

## Consequences

DSH schema changes are handled at adapters and projectors instead of throughout the component tree. Console view models may intentionally omit canonical fields only when the omission is explicit and presentation-safe. New model-visible input must still be represented by canonical DSH content and events.

## Verification

Projector tests cover replay and live event parity, text, reasoning, images, tools, todo clearing, usage, interruption, errors, multi-step assistant output, and unknown extension blocks. Typechecking verifies that runtime adapters continue to consume official DSH types.
