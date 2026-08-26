---
title: Commands
description: Reference for DSH Console slash commands and local shell mode.
---

| Command                | Purpose                                                         |
| :--------------------- | :-------------------------------------------------------------- |
| `/about`               | Show Console and DSH runtime information                        |
| `/help`                | Show available commands                                         |
| `/model`               | Select the active DSH model and reasoning effort                |
| `/new`                 | Start a fresh DSH Session                                       |
| `/permission`          | Show or change the current DSH permission preset                |
| `/provider`            | View or update supported DSH provider credentials               |
| `/quit`                | Dispose the runtime and exit                                    |
| `/resume [session-id]` | Browse Sessions or resume a full Session ID                     |
| `/sessions`            | Browse resumable Sessions for the current directory             |
| `/settings`            | View and edit Console settings                                  |
| `/stats`               | Show metrics derived from the current DSH Session               |
| `/theme`               | Change the terminal theme                                       |
| `/tools`               | Inspect tools visible to the current DSH Agent                  |
| `/vim`                 | Toggle Vim input mode                                           |
| `/profiler`            | Toggle render diagnostics when debug mode is active             |
| `!command`             | Execute a local shell command without submitting a model prompt |

During an active turn, `Ctrl+C` cancels the operation. During attachment preparation it aborts preparation and restores the prompt. While idle it exits safely.
