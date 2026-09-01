# Audited DSH source target

## Decision

Blocking Quality checks use an immutable, explicitly audited DeepSeek Harness
source commit. Repository, full commit SHA, and expected package version live in
`scripts/dsh-source-target.json`; workflows and composition scripts consume this
file instead of duplicating literals.

The target validator runs in the normal typecheck gate and before the source
checkout. It verifies the Console compatibility upper bound, every DSH host peer,
and public English and Chinese compatibility statements.

## Rationale

DeepSeek Harness is under active development. Following its default branch in a
blocking release gate would make Console builds non-reproducible and allow
unreviewed upstream changes into a release. Pinning an audited commit keeps Quality
stable while preserving an intentional upgrade path.

## Upgrade procedure

1. Audit and build the desired official Harness commit.
2. Update `scripts/dsh-source-target.json` with its full SHA and package version.
3. Advance Console compatibility metadata, DSH peer upper bounds, and public docs.
4. Run `pnpm run check:dsh-target` and the source-composition Quality job.
