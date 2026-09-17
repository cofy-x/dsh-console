# Launcher Profile Version Reconciliation

## Status

Implemented.

## Context

The public `dsh-console` executable is a launcher for a package mounted in its dedicated DSH profile. npm upgrades replace the global launcher but do not mutate an existing profile, so checking only whether the profile package exists can silently keep an older Console runtime active after an upgrade. Frequent DeepSeek Harness prereleases also require Console to retain a stable npm baseline while advancing only through explicitly audited source releases.

## Decision

The launcher owns the `dsh-console` profile package selection. Before inspecting or modifying that profile, it resolves the `dsh` executable selected from `PATH`, obtains its public version, and compares it with `dsh.compatibility` from the Console package manifest. A missing, unexecutable, invalid, or older DSH blocks startup with an exact installation command; a release newer than `maximumTested` receives a non-blocking warning. Every subsequent DSH invocation uses the same resolved executable path, avoiding a check/use mismatch. The launcher never installs or mutates global DSH.

A published launcher requires the profile dependency and installed package to match its exact package version before execution. A source checkout requires the installed profile package to resolve to that checkout. `DSH_CONSOLE_PACKAGE_SPEC` remains an explicit override and is applied before every launch. Reconciliation changes only the Console package in its dedicated profile; DSH owns the profile implementation and package installation.

Console development dependencies remain fixed to the npm-default DSH baseline. The peer dependency range and `dsh.compatibility.maximumTested` advance together only after the matching Harness source release passes API review, type checking, build, DSH composition, and package installation tests.

## Alternatives

Resolving npm's moving `latest` tag at startup was rejected because one installed launcher must select a deterministic runtime and work offline when already aligned. Leaving profile updates entirely manual was rejected because the visible executable version could differ from the runtime actually handling the session. Installing the Console package on every launch was rejected because it adds avoidable package-manager work and network sensitivity.

## Consequences

Upgrading the global Console package upgrades its dedicated profile on the next launch. Downgrading the launcher likewise selects the matching profile package, subject to its declared DSH compatibility range. Source development and package smoke tests remain explicit and cannot silently reuse a registry installation with the same version string. Users who intentionally test another package spec must keep `DSH_CONSOLE_PACKAGE_SPEC` set for that launch. Documentation installation examples are mechanically checked against the same package metadata so audited prerelease versions cannot drift independently.

## Verification

Launcher tests cover missing, old, equal, supported, newer, invalid, and failed DSH version probes before profile mutation, plus aligned source profiles, stale-profile reconciliation, explicit override precedence, restart handling, argument forwarding, ordinary exit codes, and signal propagation. The package-install gate exercises the packed launcher in an isolated `DSH_HOME` through a deterministic fake executable that delegates runtime work to the lockfile DSH baseline; DSH source composition verifies the declared maximum release.
