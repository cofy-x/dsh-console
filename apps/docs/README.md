# DSH Console Documentation Site

This package builds the public documentation at [`dsh-console.cofy-x.space`](https://dsh-console.cofy-x.space) with Astro Starlight. The site is fully static, includes Pagefind search, and publishes through Cloudflare Pages.

## Content boundary

`src/content/docs/` owns public installation, configuration, command, workflow, concept, and troubleshooting documentation. English pages are normative. Core Simplified Chinese pages live under `src/content/docs/zh-cn/`.

The repository root README remains the concise GitHub and npm entry point. Agent Notes remain maintainer-facing architecture records and are not copied into the public site.

## Local development

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run docs:dev
pnpm run docs:verify
```

The social preview combines `src/assets/social-card.svg` with `../../docs/assets/dsh-console-preview.jpg`. Regenerate the checked-in PNG after changing either source:

```sh
pnpm run docs:social-card
```

## Publication

The deployment workflow builds the same static output and uploads `apps/docs/dist` with the pinned workspace Wrangler version. Configure the GitHub environment `docs-production` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and set the repository variable `CLOUDFLARE_PAGES_PROJECT` if the Pages project is not named `dsh-console-docs`.

Attach `dsh-console.cofy-x.space` to the Pages project in Cloudflare. Account provisioning, credentials, and DNS remain operator-owned and are never encoded in this repository.
