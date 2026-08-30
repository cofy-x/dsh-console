---
title: Sessions and Resume
description: Start, browse, and resume canonical DSH Sessions for the current directory.
---

DSH owns conversation persistence. DSH Console does not maintain a parallel transcript database.

- `/new` creates a fresh DSH Agent and empty Session after confirmation when the current conversation has content.
- `/sessions` opens a dialog of persisted top-level `dsh-console-*` Sessions for the current working directory.
- `/resume` opens the same browser, while `/resume <full-session-id>` resumes a specific eligible Session.
- `dsh-console --continue` resumes the latest eligible Session before the TUI accepts input.
- `dsh-console --resume <full-session-id>` resumes an exact eligible Session and can be combined with `--prompt`.

Resume reads the canonical DSH event log, restores the historical model route, projects the visible surface into the TUI, and continues with the next turn. The switch is transactional: an unavailable model, damaged log, failed flush, or cancellation leaves the active Session unchanged.

The main Agent is materialized only when the first prompt or an Agent-dependent DSH command needs it. Opening and leaving an unused Console therefore does not persist another empty Session, and historical Sessions without trajectory events are excluded from the browser.

Completion Sessions, Side conversation Sessions, delegated Agent Sessions, and Sessions from another working directory do not appear in the main browser. Cross-directory search, rename, delete, and fork are not part of the current alpha.
