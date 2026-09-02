# Audited DSH source target

## Decision

DSH Console maintains a two-endpoint compatibility matrix. The minimum endpoint is the published npm version declared by `dsh.compatibility.minimum`; the maximum endpoint is the immutable, explicitly audited DeepSeek Harness source commit declared by `scripts/dsh-source-target.json` and `dsh.compatibility.maximumTested`.

The frozen lockfile owns the minimum development dependency graph. The audited source target owns the maximum graph. Verification asserts the versions actually resolved from `node_modules` before running either endpoint gate, so an environment name, install command, or pre-existing source link cannot substitute for endpoint identity.

DSH-facing production code, canonical type usage, fixtures, probes, and metadata must compile and behave at both endpoints. Compatibility adaptations stay at explicit DSH boundaries and preserve one canonical runtime behavior.

## Rationale

DeepSeek Harness evolves independently from Console. A published minimum keeps existing installations supported, while an immutable maximum lets Console adopt reviewed API evolution without following a moving branch. Testing both endpoints prevents source-linked development environments from masking regressions in the public package baseline.

## Verification contract

The minimum endpoint runs in an isolated checkout installed from the frozen lockfile and covers format, lint, typecheck, CLI build, workspace tests, DSH composition, and packaged installation. The maximum endpoint uses packages selected from the audited source commit and covers typecheck, CLI build, workspace tests, and DSH composition. A result covering only one endpoint or an incomplete command sequence is partial validation and is not sufficient for commit or synchronization of compatibility changes.

## Upgrade procedure

1. Audit and build the desired official Harness commit.
2. Update `scripts/dsh-source-target.json` with its full SHA and package version.
3. Advance Console compatibility metadata, DSH peer upper bounds, and public docs.
4. Keep version-sensitive access behind focused compatibility boundaries and update fixtures and probes to exercise the same behavior at both endpoints.
5. Run the complete minimum and maximum endpoint gates before committing or synchronizing the compatibility change.
