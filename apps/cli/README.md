# DSH Console

`dsh-console` is a TypeScript and React/Ink terminal frontend for
[DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness).

> DSH Console is currently a public alpha. Commands and UI details may change
> before the first stable release.

## Install

DSH Console requires Node.js 24 or newer and a working DSH provider
configuration.

```sh
npm install --global @deepseek-ai/dsh @cofy-x/dsh-console@alpha
dsh-console --prompt "hello"
```

Alpha releases use the `alpha` npm dist-tag and do not update `latest`.

## Use

The launcher initializes or locates the `dsh-console` DSH profile and starts an
interactive terminal session. Useful commands include:

```text
/model       Select the active DSH model
/new         Start a fresh conversation
/sessions    Browse resumable sessions for the current directory
/resume      Resume a session
/tools       Inspect tools exposed by the active DSH agent
/permission  Select the active DSH permission preset
/theme       Select the terminal theme
/settings    Edit Console settings
```

DSH owns provider credentials, model routing, session logs, and attachments.
DSH Console does not maintain a separate authentication or session database.

See the [GitHub repository](https://github.com/cofy-x/dsh-console) for source
development, architecture, alpha boundaries, and license attribution details.
