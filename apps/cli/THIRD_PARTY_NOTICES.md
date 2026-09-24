# Third-Party Notices

## DeepSeek Harness preset resources

The generated `dist/presets/*.patch.yml` files are copied unchanged from the public exports of the audited `@deepseek-ai/dsh-web-app` package. Their license follows.

MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Other dependencies

DSH Console retains and adapts portions of the terminal UI and supporting
utilities from [Gemini CLI](https://github.com/google-gemini/gemini-cli),
Copyright 2025 Google LLC, licensed under Apache-2.0. Files derived from that
work retain a Google LLC copyright header. DSH-native adapters and subsequent
original work are Copyright cofy-x.

The npm package keeps third-party runtime packages external. They are resolved
by the package manager and retain their own license files and notices.

| Dependency                 | License      |
| -------------------------- | ------------ |
| `@deepseek-ai/dsh-cmdline` | MIT          |
| `@deepseek-ai/schemastery` | MIT          |
| `@xterm/headless`          | MIT          |
| `ansi-escapes`             | MIT          |
| `ansi-regex`               | MIT          |
| `chalk`                    | MIT          |
| `chardet`                  | MIT          |
| `clipboardy`               | MIT          |
| `commander`                | MIT          |
| `comment-json`             | MIT          |
| `diff`                     | BSD-3-Clause |
| `dotenv`                   | BSD-2-Clause |
| `fdir`                     | MIT          |
| `fzf`                      | BSD-3-Clause |
| `ignore`                   | MIT          |
| `ink` (`@jrichman/ink`)    | MIT          |
| `ink-gradient`             | MIT          |
| `ink-spinner`              | MIT          |
| `lowlight`                 | MIT          |
| `mnemonist`                | MIT          |
| `picomatch`                | MIT          |
| `react`                    | MIT          |
| `string-width`             | MIT          |
| `strip-ansi`               | MIT          |
| `strip-json-comments`      | MIT          |
| `tinygradient`             | MIT          |
| `undici`                   | MIT          |
| `yargs`                    | MIT          |
| `zod`                      | MIT          |

DeepSeek Harness services are supplied by the active DSH profile through the
optional peer dependencies declared in `@cofy-x/dsh-console`. Those packages
retain their own licenses and notices.
