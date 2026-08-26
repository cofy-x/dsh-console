---
title: Troubleshooting
description: Diagnose common installation, provider, Session, attachment, and terminal issues.
---

## The Console asks for a credential

Use the masked first-run dialog or run `/provider` to configure a supported writable DSH credential source. Environment-backed and other read-only sources must be changed outside the Console.

## A model is unavailable

Open `/model` and select a route exposed by the active DSH profile. Resume intentionally fails rather than silently replacing a historical model that DSH can no longer resolve.

## A Session does not appear

The current alpha lists persisted top-level `dsh-console-*` Sessions for the current working directory. Completion Sessions and Sessions from another directory are excluded.

## The model cannot use an image

Confirm that the selected model supports image input and that the attachment card appears in the user message. DSH Console submits a canonical image attachment reference, not a workspace path. A model choosing an unrelated file tool is model or tool-routing behavior rather than image admission.

## Terminal keys or colors look wrong

Run in a regular PTY, confirm that `TERM` describes the terminal, and try another built-in theme. Use `dsh-console --debug` when collecting diagnostics. DSH Console does not modify global IDE keybindings.
