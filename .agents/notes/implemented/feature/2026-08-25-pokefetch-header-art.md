# Pokefetch Header Art

Status: Implemented

## Context

DSH Console uses colored Pokémon ANSI art as a distinctive startup experience. The original bundled subset came from `cofy-x/pokefetch`, whose generated assets in turn derive from PokeAPI sprite images and carry third-party copyright and trademark considerations that are not covered by the repository's Apache-2.0 license.

## Decision

DSH Console vendors a complete, pinned snapshot of the Pokefetch Pokémon asset pack so startup remains offline, deterministic at the package level, and independent of a shell installation. The resource manifest records the upstream repository, exact commit, source directory, asset count, and deterministic content digest. `scripts/sync-pokefetch-assets.mjs` is the only supported update path.

The runtime continues to select and read only one asset at startup. Attribution stays out of the primary startup composition; `/about` exposes the full project URL. The existing internal `pokemon` resource type remains stable while user-facing settings identify the source as `Pokefetch Pokémon`.

## Alternatives

Invoking the Pokefetch shell script at runtime was rejected because it would introduce an external installation and process dependency. Downloading assets during build or startup was rejected because it would break offline and reproducible packaging. Publishing a separate npm asset package was deferred because the compressed snapshot is small and does not yet justify another release lifecycle.

## Consequences

The npm package contains hundreds of small text resources, but their compressed payload is modest and startup memory remains bounded to the selected asset. Asset updates are intentional source changes that require a new upstream pin, regenerated manifest, updated third-party review, and package-content validation. Apache-2.0 does not relicense the Pokémon-derived assets or associated marks.

## Verification

Asset synchronization must reject dirty or unrelated source checkouts and reproduce the manifest count and digest from the pinned Pokefetch commit. Header loader tests cover the bundled pack, `/about` tests cover visible attribution, and the package-install gate must enumerate the actual installed tree, recompute the asset digest, and reject unexpected public files outside the declared package surface.
