# Third-Party Notices

DSH Console retains and adapts portions of the terminal UI and supporting
utilities from [Gemini CLI](https://github.com/google-gemini/gemini-cli),
Copyright 2025 Google LLC, licensed under Apache-2.0. Files derived from that
work retain a Google LLC copyright header. DSH-native adapters and subsequent
original work are Copyright cofy-x.

The npm package keeps third-party runtime packages external. They are resolved
by the package manager and retain their own license files and notices.

| Dependency | License |
| --- | --- |
| `@deepseek-ai/dsh-cmdline` | MIT |
| `@deepseek-ai/schemastery` | MIT |
| `@xterm/headless` | MIT |
| `ansi-escapes` | MIT |
| `ansi-regex` | MIT |
| `chalk` | MIT |
| `chardet` | MIT |
| `clipboardy` | MIT |
| `commander` | MIT |
| `comment-json` | MIT |
| `diff` | BSD-3-Clause |
| `dotenv` | BSD-2-Clause |
| `fdir` | MIT |
| `fzf` | BSD-3-Clause |
| `ignore` | MIT |
| `ink` (`@jrichman/ink`) | MIT |
| `ink-gradient` | MIT |
| `ink-spinner` | MIT |
| `lowlight` | MIT |
| `mnemonist` | MIT |
| `picomatch` | MIT |
| `react` | MIT |
| `string-width` | MIT |
| `strip-ansi` | MIT |
| `strip-json-comments` | MIT |
| `tinygradient` | MIT |
| `undici` | MIT |
| `yargs` | MIT |
| `zod` | MIT |

DeepSeek Harness services are supplied by the active DSH profile through the
optional peer dependencies declared in `@cofy-x/dsh-console`. Those packages
retain their own licenses and notices.

## Pokefetch Pokémon header art

The bundled ANSI header art maintained under `apps/cli/src/ui/components/layout/resources/pokemon/` and distributed under `dist/ui/components/layout/resources/pokemon/` is a snapshot of [`cofy-x/pokefetch`](https://github.com/cofy-x/pokefetch) at commit `d97744c87eee043531097155d6be984e062fc6b1`.

Pokefetch generated these assets with [`cofy-x/pixel-to-ascii`](https://github.com/cofy-x/pixel-to-ascii) from images in the [`PokeAPI/sprites`](https://github.com/PokeAPI/sprites) `sprites/pokemon/versions/generation-viii/icons` directory. The PokeAPI sprites repository states that the image contents are copyright The Pokémon Company and that the repository is distributed under CC0 1.0 Universal; it also notes that CC0 does not affect trademark rights or represent that third-party rights have been cleared.

The Apache-2.0 license for DSH Console does not relicense the Pokémon source images, Pokémon-derived ANSI assets, names, characters, artwork, or trademarks. DSH Console and Pokefetch are unofficial fan projects and are not affiliated with, endorsed by, or sponsored by Nintendo, Game Freak, Creatures, or The Pokémon Company. Pokémon and related marks are trademarks of their respective owners.
