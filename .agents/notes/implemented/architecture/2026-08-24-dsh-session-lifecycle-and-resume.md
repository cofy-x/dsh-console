# DSH Session Lifecycle and Resume

## Status

Implemented.

## Context

Session history must remain consistent with the Agent context used by DSH. A parallel Console session database would create competing sources of truth and make replay, attachments, tools, and model routing diverge from the runtime.

## Decision

DSH JSONL persistence and session events are the only durable conversation source. Console lists eligible top-level `dsh-console-*` sessions for the current working directory through DSH session query services and resumes them through `agents.resume()`.

Fresh creation, model switching, and resume use a transactional active-conversation switch. A candidate Agent and projector are prepared first, the current Session is flushed, and the active handle, subscription, transcript, model snapshot, and Session identity are exchanged only after preparation succeeds. Failure preserves the current conversation and input.

Resume replaces the visible transcript with canonical replay from the target Session. Historical model routing is restored from the last usable request header, and resumed live events continue through the same projector used for replay.

## Alternatives

Restoring the legacy client-owned session store was rejected because it duplicates DSH persistence. Merging transcripts from different Sessions was rejected because the visual history would no longer represent the active model context. Partial switching before flush or resume completion was rejected because failures could strand the UI between Agents.

## Consequences

Session discovery is intentionally scoped to the current working directory and Console-owned top-level sessions. Cross-directory search, rename, delete, fork, and automatic startup resume require separate product decisions. Corrupt or incompatible historical sessions fail without clearing the current transcript.

## Verification

Runtime and UI tests cover filtering, title fallback, model restoration, canonical replay, unknown or damaged sessions, flush failure, busy rejection, successful transcript replacement, and continued turns after resume. Integration tests exercise real DSH JSONL persistence and `agents.resume()`.
