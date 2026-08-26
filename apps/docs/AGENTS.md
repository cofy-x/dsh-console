# Documentation Site Agent Contract

## Purpose

`apps/docs` is the public DSH Console documentation product. It owns the static Starlight site, localized user journeys, public visual assets, and Cloudflare Pages build contract.

Read this file, the repository root `AGENTS.md`, and `apps/docs/README.md` before changing the site.

## Content ownership

- English content is normative. Simplified Chinese content lives under `src/content/docs/zh-cn/` and should stay synchronized for installation, requirements, commands, and current product behavior.
- Public pages document shipped DSH Console behavior. Do not document planned commands or DSH contracts as available before implementation lands.
- DeepSeek Harness owns agents, models, credentials, sessions, tools, attachments, persistence, and canonical events. The site must not imply that DSH Console reimplements those services.
- Agent Notes and maintainer-only release procedures are not public user documentation and must not be copied into this site.

## Implementation

- Keep the site fully static. Do not add SSR, Pages Functions, databases, analytics backends, or Cloudflare runtime bindings without a separate product requirement.
- Use Starlight navigation, accessibility, Pagefind search, and locale behavior rather than replacing the documentation shell.
- Keep custom UI focused on the homepage and shared visual tokens. Maintain responsive layouts and honor `prefers-reduced-motion`.
- Read the public CLI package version at build time when the site displays a release number; do not maintain a second release version manually.
- Pin Wrangler and GitHub Actions used by deployment workflows.
- Keep Markdown prose paragraphs on one physical line. Do not hard-wrap prose.

## Validation

Run from the repository root:

```sh
pnpm run docs:check
pnpm run docs:build
pnpm run docs:verify
```

Run `pnpm run docs:social-card` when the editable social preview SVG or its terminal preview image changes. The asset check rejects a stale generated PNG.
