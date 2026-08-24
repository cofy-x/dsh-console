# Image Attachment Admission

## Status

Implemented.

## Context

Workspace image references and clipboard images begin as local files, but models must receive canonical DSH image blocks backed by the DSH attachment store. Embedding provider-specific base64 data or exposing temporary local paths would bypass DSH ownership and break replay.

## Decision

`PromptInputRuntime` produces local image-source parts that contain only a validated source path, source kind, display name, and declared media type. `DshAttachmentInputAdapter` is the only layer that reads those files, calls the official attachment service, and constructs canonical DSH image content blocks.

All images for a submission must be admitted before `agent.followup()` creates the user turn. Admission failure or preparation cancellation restores the original prompt and creates no Session event. Successful clipboard sources may be removed after persistence; workspace files are never removed. React receives attachment view models rather than DSH attachment references.

## Alternatives

Provider-specific inline base64 payloads were rejected because Console does not own provider request formats. Sending a local path as prompt text was rejected because the model may attempt an unrelated filesystem tool call and the path is not durable attachment content. Falling back silently to text-only submission was rejected because it changes user intent.

## Consequences

The initial surface supports PNG, JPEG, WebP, and GIF images. Generic files, PDF, audio, video, and native terminal image protocols require separate ingestion and presentation decisions. Cancellation after immutable DSH persistence may leave an unreferenced attachment object but never creates a conversation turn.

## Verification

Tests cover source ordering, workspace and symlink containment, clipboard trust, unsupported media, attachment persistence order, cancellation before and during persistence, failed admission, canonical image projection, attachment cards, replay, and multi-turn continuation.
