# Release dependency refresh boundaries

## Status

Implemented.

## Context

Release preparation can reveal advisories in Console runtime dependencies, documentation tooling, and the host-provided DSH graph. Updating an unchanged exact parent does not necessarily refresh its existing transitive package snapshots, even when patched child versions satisfy the parent's declared range.

## Decision

Keep DSH runtime peers and the audited source endpoint aligned with one immutable public release. Refresh third-party dependencies only within their declared ranges; do not add DSH overrides to replace an upstream exact pin or imply that Console controls the installed Host graph. Exact documentation-owned pins may advance to patched upstream releases, including the deployment tool that owns its own image-processing dependency.

The [documentation-toolchain security decision](../../proposed/process/2026-10-10-documentation-toolchain-security.md) explicitly approves two version-bounded documentation-only compatibility exceptions for rc.3, with exit criteria and focused rendering tests. It does not relax the DSH ownership boundary or authorize generic cross-major overrides.

When an incremental update preserves vulnerable snapshots, resolve the existing manifests in an isolated checkout without an inherited lockfile or installed dependency tree. Adopt that generated lockfile only after checking the resulting advisories and running both compatibility endpoints. Preserve existing workspace policies; do not use an audit fix that silently adds overrides or changes public compatibility ranges.

## Alternatives

Ignoring advisory output would conceal unresolved risks. Broad dependency overrides could escape an upstream compatibility contract and make the registry and immutable source gates describe different products. Hand-editing transitive lockfile entries would bypass package-manager resolution and integrity checks.

## Consequences

A clean resolution can refresh unrelated compatible transitive versions, so it requires the complete release gates rather than only testing the originally vulnerable package. Unresolved alerts require explicit disclosure and a release decision; an earlier acceptance does not silently approve newly introduced risks. Development classification alone does not make a DSH runtime dependency irrelevant.

## Verification

The registry endpoint verifies the frozen dependency tree, formatting, lint, types, CLI build, workspace tests, DSH composition, and isolated packaged installation. The immutable source endpoint independently verifies types, build, tests, and composition. Documentation changes also run the static site and link checks. Record full audit output separately from product gate results and never claim that passing tests proves a vulnerability-free dependency graph.
