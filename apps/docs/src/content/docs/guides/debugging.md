---
title: Debugging
description: Run DSH Console diagnostics and inspect logs without mixing them into the transcript.
---

Start the Console with diagnostics enabled:

```sh
dsh-console --debug
```

When using the workspace script, arguments follow the script separator:

```sh
pnpm start -- --debug
```

Debug mode enables the structured debug console and makes `/profiler` available for React/Ink render diagnostics. Diagnostic output stays outside prompts and Session events.

Credential fields are masked UI surfaces. Credential characters and paste contents are not emitted by the masked input path, even when keystroke diagnostics are enabled elsewhere.
