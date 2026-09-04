---
title: Commands
description: Reference for DSH Console slash commands and local shell mode.
---

| Command           | Purpose                                                            |
| :---------------- | :----------------------------------------------------------------- |
| `/about`          | Show Console and DSH runtime information                           |
| `/agents`         | Browse delegated Agents and open their read-only canonical history |
| `/btw <question>` | Open or continue a multi-turn Side conversation                    |
| `/help`           | Show commands available from Console and the active DSH profile    |
| `/model`          | Select the active DSH model and reasoning effort                   |
| `/new`            | Start a fresh DSH Session                                          |
| `/permission`     | Show or change the current DSH permission preset                   |
| `/plan`           | Enter plan mode when supplied by the active DSH profile            |
| `/provider`       | View or update supported DSH provider credentials                  |
| `/quit`           | Dispose the runtime and exit                                       |
| `/sessions`       | Browse resumable Main Sessions for the current directory           |
| `/settings`       | View and edit Console settings                                     |
| `/stats`          | Show metrics derived from the current DSH Session                  |
| `/theme`          | Change the terminal theme                                          |
| `/tools`          | Inspect tools visible to the current DSH Agent                     |
| `/vim`            | Toggle Vim input mode                                              |
| `/profiler`       | Toggle render diagnostics when debug mode is active                |
| `!command`        | Execute a local shell command without submitting a model prompt    |

`/plan` is a DSH command rather than a built-in Console command. Profile plugins may add or remove DSH commands, and `/help` plus slash completion reflect the active runtime.

## Keyboard shortcuts

| Shortcut | Purpose                                                                           |
| :------- | :-------------------------------------------------------------------------------- |
| `Ctrl+/` | Switch between Main and Side conversations when Side exists                       |
| `Ctrl+T` | Expand or collapse the full Todo tray                                             |
| `Ctrl+C` | Clear input, cancel active preparation or work, or request a safe exit while idle |
| `Tab`    | Accept or move through prompt, path, and slash-command completion where available |

Cancellation is contextual. During attachment preparation `Ctrl+C` aborts preparation and restores the prompt; during a running turn it cancels the current DSH operation; while idle it requests a safe exit.
