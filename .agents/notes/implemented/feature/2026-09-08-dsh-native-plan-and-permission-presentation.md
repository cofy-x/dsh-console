# DSH-native Plan and permission presentation

## Status

Implemented.

## Context

DeepSeek Harness owns Plan mode and permission presets as independent session capabilities. DSH publishes Plan state through the `plan` projection and accepts changes through `/plan`; it publishes configured permission options through the `permissions` projection and accepts named selections through `/permission`. The default DSH composition provides `workspace-write` and `danger-full-access`, while deployments may configure other named presets.

## Decision

DSH Console projects these capabilities without creating a combined mode state. Shift+Tab toggles only the DSH Plan selection and preserves the current permission preset. The prompt and status area may visually summarize Plan and permission together, but the runtime continues to read each DSH projection independently. Console gives dedicated presentation to the two default DSH presets and presents every other advertised preset by its configured name. It does not reserve or synthesize preset identifiers that DSH does not provide.

## Alternatives

Cycling through locally defined Plan, Auto, and Full Access modes was rejected because it would couple independent DSH capabilities and could issue unsupported permission commands. Treating only the two default presets as valid was rejected because DSH explicitly permits deployment-configured presets.

## Consequences

Plan can be active with any permission preset, and leaving Plan restores no permission because none was changed. A custom preset appears automatically when DSH advertises it, without console source changes or special styling. New first-class DSH presets can receive dedicated presentation only after their identifiers and semantics become part of the audited DSH capability.

## Verification

Runtime tests cover Plan toggling without permission writes, lazy conversation preparation, pending Plan state, and preservation of Full Access. The DSH minimum and maximum compatibility gates validate the shared behavior against both declared endpoints before commit or synchronization.
