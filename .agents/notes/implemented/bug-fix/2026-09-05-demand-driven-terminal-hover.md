# Demand-driven terminal hover

## Status

Implemented.

## Context

DECSET 1002 reports button motion but not passive pointer movement, so clickable regions could not present hover feedback until a click or drag occurred. Enabling DECSET 1003 globally would fix detection but would also increase stdin traffic and capture more terminal mouse behavior, including native text-selection gestures.

## Decision

The terminal API exposes explicit `button-motion` and `any-motion` policies and remembers the last explicitly requested policy across temporary suspensions. `MouseProvider` installs its stdin listener before enabling reporting, aggregates active subscription requirements, and enables any-motion only while at least one hover subscriber exists. `useMouseHover` owns Ink bounding-box hit testing and suppresses unchanged state transitions, while `InteractiveRegion` exposes the resulting state to visual callers. Mouse handling remains limited to alternate-buffer sessions where mouse events are enabled, and existing priority dispatch determines the highest-priority responding surface.

## Alternatives

Replacing DECSET 1002 with DECSET 1003 globally was rejected because passive motion is unnecessary for click-only screens and can generate substantial event traffic. Component-local stdin listeners and coordinate checks were rejected because they duplicate parsing, lifecycle cleanup, and modal-priority behavior.

## Consequences

Startup actions, Pokémon art, the Footer model entry, and dialog close actions receive immediate hover feedback without losing their keyboard paths or default visual affordances. Terminals may require their existing selection modifier while a hoverable alternate-buffer surface is active, but any-motion is removed as soon as demand ends and all 1002, 1003, and 1006 modes are disabled during cleanup.

## Verification

Protocol tests cover both tracking policies, restoration, and complete cleanup. Provider and Hook tests cover listener ordering, the first passive move, enter and leave transitions, unchanged-state suppression, demand removal, disabled mouse events, cleanup, and priority handling; the repository preflight covers existing click and selection-warning regressions.
