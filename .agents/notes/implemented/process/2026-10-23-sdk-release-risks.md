# SDK release risks accepted for Console rc.4

## Status

Accepted for DSH Console `0.1.0-rc.4` with official DSH `0.2.1-rc.2` only. The supported SDK graph retains the two affected dependencies described below; this decision does not record a remediation.

## Context

Official DSH `0.2.1-rc.2` pins `@modelcontextprotocol/client` to `2.2.0`. [GHSA-6prh-2h8m-c8cw](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw) covers HTTP transport and OAuth requests following cross-origin redirects, exposing custom headers and, for `307` or `308`, request bodies. MCP client `2.3.0` contains the upstream fix, but this DSH release has not adopted it. Stdio clients are unaffected by this issue, and the default Console profile declares no MCP servers.

The audited DSH graph also includes `@deepseek-ai/libreoffice-kit` `0.1.5`, which pins `fflate` to `0.8.2`. [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98) describes an infinite loop in `unzipSync` for malformed ZIP64 input. The Office worker uses that function to inspect document archives before conversion. Fflate `0.8.3` contains the upstream fix, but the SDK-resolved Office dependency retains the affected exact pin.

## Decision

Proceed with the rc.4 release with explicit disclosure of both advisories in its changelog and English and Chinese troubleshooting pages. Recommend temporarily disabling configured HTTP MCP connections or using stdio, and avoiding untrusted Office archives in DSH Office processing. Keep the official DSH runtime graph, exact SDK peers, and audited source endpoint intact; do not add Console dependency overrides or parallel transport or archive implementations.

This acceptance covers only the two listed advisories in this official SDK baseline for this release. Reassess remaining advisories before every subsequent release; newly discovered risks and changed exposure are not automatically accepted. Upgrade the audited DSH baseline when official releases incorporate the fixes, and validate both compatibility endpoints before declaring either issue resolved.

## Alternatives

Deferring rc.4 until DSH ships corrected dependencies would postpone the Console fixes. Overriding the MCP client or fflate locally would replace upstream exact pins without demonstrating the official SDK's compatibility. Suppressing either alert or treating default feature configuration as a repair would conceal the remaining exposure.

## Consequences

Configured HTTP MCP users and users processing untrusted Office archives retain the disclosed risks. This release neither disables their existing configuration nor claims that either affected dependency is repaired. The exception does not weaken the [dependency refresh boundaries](2026-10-09-release-dependency-refresh.md) for unrelated dependencies or later releases.

## Verification

Confirm the exact MCP and Office dependency pins in official package manifests and the lockfile, inspect the default composition for MCP server declarations and the Office worker's archive inspection call, and check both advisories' affected operations. Keep the SDK-inclusive audit distinct from the Console production-only audit: optional Host packages can be absent from a production-only dependency graph. Passing functional gates or a clean production-only audit does not prove that either upstream issue is fixed. Validate the disclosure with the existing documentation checks, static site build, and link checks; preserve raw audit and release evidence in ignored artifacts.
