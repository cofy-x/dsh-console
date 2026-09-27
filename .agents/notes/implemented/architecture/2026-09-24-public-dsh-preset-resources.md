# Public DSH preset resources

## Status

Implemented.

## Context

DSH replaced directory-based Agent presets with a declarative registry. The shipped definitions are publicly exported patch resources in `@deepseek-ai/dsh-web-app`, separate from that package's browser application patch. Console must preserve Harness-owned tool, prompt, Skill and selection policy without activating the browser surface.

## Decision

The CLI bundle declares the preset patch destinations. The CLI build resolves the corresponding public package exports and copies their bytes unchanged into `dist/presets`, checking the source package version against the existing compatibility metadata. Only the Console Host patch and those preset resources enter the Console profile. Runtime services remain Host-provided peers; the Web package is a build-only dependency. Third-party notices include the resources' MIT license.

## Alternatives

Hand-maintained copies would drift with DSH policy. Mounting the complete Web bundle would activate an unrelated surface. Reading private source files or rebuilding presets from tool names would bypass the public package boundary.

## Consequences

Preset composition changes only when Console advances its audited DSH baseline and rebuilds. The registry remains responsible for effective defaults, activation diagnostics, retained revisions and scoped services. In `0.1.7-rc.2`, the public roster no longer carries a mode-selection switch; Console does not recreate that removed policy from Web-specific settings. Removed upstream presentation fields, such as directory trust, are not reconstructed. Console does not write compatibility exemptions for newer DSH hosts; Harness owns those admission decisions.

Console refreshes the public roster on explicit picker operations, sharing concurrent reads rather than caching declarations indefinitely. A deferred explicit selection passes directly to the public Harness `resolve` operation when creating a Session; an unnamed Session resolves the Host effective default. The public `select` operation enforces whether an existing Session may change composition, including its Turn boundary. Existing Sessions retain their Harness-owned composition. No private configuration watchers or polling are added.

## Verification

The package gate compares the bytes of every preset patch in the installed tarball with its exported source and checks that every declared bundle patch is shipped. Both compatibility endpoints exercise the composed profile, blank-session preset selection, Skill invocation and Session fork/resume through the existing integration gate.
