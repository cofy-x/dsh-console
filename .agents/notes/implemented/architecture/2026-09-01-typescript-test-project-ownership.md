# TypeScript test project ownership

## Decision

The CLI editor TypeScript project owns both production source and colocated tests.
The emit-oriented `tsconfig.build.json` continues to exclude tests from published
artifacts.

Test fixtures follow the same public contracts as production code. Shared helpers
therefore construct complete execution contexts instead of returning a broader
context and relying on implicit narrowing at each call site.

JavaScript and MJS scripts are owned by `scripts/tsconfig.json` with `checkJs`
disabled. This supplies Node and workspace compiler context without turning legacy
runtime scripts into an unrelated strict-JavaScript migration.

## Consequences

- VS Code and `pnpm run typecheck` report the same CLI test diagnostics.
- Contract drift in mocks and fixtures fails the normal quality gate.
- Package builds remain independent of test-only files.
- Astro's Markdown integration is resolved to one compatible patch release so
  Starlight does not load incompatible duplicate `satteri` type identities.
