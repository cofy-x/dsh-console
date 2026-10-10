# Documentation Toolchain Security for Console rc.3

## Status

Accepted implementation decision for the local 0.1.0-rc.3 candidate; validation and publication are tracked separately. This note remains proposed until the change is merged and shipped.

## Context

GitHub reports four open documentation-toolchain Dependabot alerts: braces (GHSA-vfj7-8cjw-p6xm), postcss-selector-parser (GHSA-rj75-hqrm-r3gf), katex (GHSA-238p-pmpm-9mq7), and smol-toml (GHSA-r4xh-jqrq-34v2). The latest markdownlint-cli2 still introduces unpatched braces and exact-pinned vulnerable smol-toml. The current Expressive Code and micromark math parents do not yet declare ranges that admit the relevant patched rendering dependencies.

## Decision

Remove markdownlint-cli2 and use markdownlint 0.41.1 through its public Promise API. Keep the original lint boundary (the documentation README, AGENTS, and public Markdown content), all default rules, and the three existing configuration exceptions. Enumerate regular files deterministically without a globbing or configuration-parser dependency and fail closed on missing required files or invalid configuration.

Approve exactly two documentation-only exceptions to the [release dependency refresh policy](../../implemented/process/2026-10-09-release-dependency-refresh.md): `@expressive-code/core@^0.44.0>postcss-nested` resolves to 7.0.2, whose selector parser can resolve to patched 7.1.6; `micromark-extension-math@3.1.0>katex` resolves to patched 0.18.2. The parent selectors are version bounded and do not affect DSH dependencies. Preserve every existing workspace override and build policy.

Remove the CSS override once Expressive Code declares a compatible PostCSS Nested range resolving only patched selector parsers, and remove the math override once micromark-extension-math declares a compatible KaTeX range resolving only patched releases. A parent major upgrade requires a fresh compatibility decision rather than widening these selectors automatically. Direct rendering dev dependencies exist only to exercise the exact patched packages through their public APIs.

## Alternatives

Keeping or changing Markdownlint CLI wrappers retains vulnerable transitive dependencies. Disabling alerts, weakening lint rules, patching node_modules, broad global overrides, or replacing DSH exact pins does not address the dependency ownership boundary. PostCSS Nested 8 and KaTeX 0.19 are unnecessary additional major changes for these fixes.

## Consequences

The production Console runtime, DSH peer range and immutable source endpoint remain unchanged. The documentation tooling owns its small file walker and diagnostic formatter. Compatibility tests cover unchanged lint behavior, nested selectors and media rules, inline and display math, rejected unsafe URLs, and rejection of inherited KaTeX trust options without mutating global prototypes. The real static site build and link checks exercise the actual Starlight integration.

## Verification

Run the isolated published-npm minimum `preflight` and `docs:verify`, then the immutable DSH-source maximum contract check, typecheck, CLI build, workspace CI tests, DSH integration test and packaged installation test. Generate the lockfile through pnpm and run a full workspace dependency audit, including development dependencies, to confirm that all four targeted advisories are absent; report unrelated upstream advisories separately. Capture exact Git endpoints, commands, exit statuses and audit evidence under Hangar's ignored `artifacts/releases/console-rc3-docs-security-2026-10-10/`. GitHub alerts are not considered closed until the fix reaches the default branch and GitHub rescans it. No push, tag or publication is authorized by this decision.
