# Public Prerelease npm Release

## Status

Implemented.

## Context

DSH Console is published from a multi-package workspace, but only the CLI package is a public npm product. Releases need reproducible package validation, explicit human approval, and authentication that does not store a long-lived npm publishing token.

## Decision

The workspace root remains private and `apps/cli` is the public `@cofy-x/dsh-console` package. Public prereleases use `alpha` or `rc` semver identifiers while remaining available through npm's default `latest` channel so the documented installation command does not require a dist-tag suffix. `scripts/release-version.mjs` owns this policy for local composition checks, Release Check, and publication; stable versions, unknown channels, and malformed identifiers remain rejected.

Console packages exported DSH preset resources unchanged, including upstream tool and delegation policy. A wider runtime compatibility window must demonstrate that the same packaged resources work on every claimed endpoint; rebuilding different resources at each endpoint alone does not establish that guarantee. Keep the release baseline aligned with the audited preset source unless that cross-version artifact contract is explicitly implemented and verified. Published npm and immutable source installations remain separate verification endpoints even when their versions match.

`Release Check` validates an exact ref and expected version without publishing. A `v*` tag invokes the publish workflow, which verifies that the tag equals the package version, runs the complete release checks, enters the protected `npm` GitHub environment, and publishes with npm Trusted Publishing through OIDC. The npm Trusted Publisher is restricted to `cofy-x/dsh-console`, `publish.yml`, the `npm` environment, and publish permission.

## Alternatives

Publishing the workspace root was rejected because it is orchestration rather than a product. A permanent npm automation token was rejected in favor of short-lived OIDC identity. Requiring users to install `@alpha` was rejected during Public Alpha because the prerelease identifier already communicates maturity and the extra channel suffix makes installation less discoverable.

## Consequences

The initial `0.1.0-alpha.0` publication was the one-time manual bootstrap required before npm could attach a Trusted Publisher, and it intentionally has no matching Git tag. Every subsequent release requires a package version change and an exact matching Git tag. The GitHub environment provides an explicit approval gate before publication. Enabling stable releases or additional preview channels requires a separate decision and a change to the shared version policy rather than independently relaxing workflow checks.

## Verification

Quality and Release Check run lint, typecheck, build, workspace tests, DSH composition, isolated packaged installation, and tarball inspection. `pnpm run test:release`, included in `test:ci`, covers accepted alpha/rc identifiers and rejected stable, unknown, and malformed versions. Registry verification confirms public access, package identity, version, executable mapping, and anonymous installation.
