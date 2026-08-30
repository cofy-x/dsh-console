---
title: Troubleshooting
description: Diagnose common installation, provider, Session, attachment, and terminal issues.
---

## The Console asks for a credential

Use the masked first-run dialog or run `/provider` to configure a supported writable DSH credential source. Environment-backed and other read-only sources must be changed outside the Console.

## A model is unavailable

Open `/model` and select a route exposed by the active DSH profile. Resume intentionally fails rather than silently replacing a historical model that DSH can no longer resolve.

## A Session does not appear

The current alpha lists persisted top-level Main `dsh-console-*` Sessions with trajectory events for the current working directory. Empty startup, completion, Side, delegated Agent, and other-directory Sessions are excluded. Confirm that the launcher uses the same working directory and `DSH_HOME`.

## `/plan` does not appear

`/plan` is supplied by the active DSH profile, not hard-coded by Console. Type `/` or run `/help` after startup to trigger command discovery. If it remains unavailable, confirm that the selected DSH profile includes the plan command plugin.

## `Ctrl+/` does not switch conversations

The shortcut is active only after a Side conversation exists. Start one with `/btw <question>`. Console accepts the legacy control byte and enhanced keyboard protocol forms, but a terminal or multiplexer may reserve the chord before it reaches the application.

## An idle Todo still shows an unfinished item

The Todo tray renders the latest canonical snapshot. An unfinished item after the turn ends means the model did not mark it complete; it does not indicate hidden background work. Press `Ctrl+T` to inspect the full list.

## The model cannot use an image

Confirm that the selected model supports image input and that the attachment card appears in the user message. DSH Console submits a canonical image attachment reference, not a workspace path. A model choosing an unrelated file tool is model or tool-routing behavior rather than image admission.

## Terminal keys or colors look wrong

Run in a regular PTY, confirm that `TERM` describes the terminal, and try another built-in theme. Use `dsh-console --debug` when collecting diagnostics. DSH Console does not modify global IDE keybindings.
