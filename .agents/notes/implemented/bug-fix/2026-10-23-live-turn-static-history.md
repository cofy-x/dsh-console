# Live Turns and Static Terminal History

## Status

Implemented.

## Context

Ink's ordinary-buffer `Static` output prints each item once. DSH publishes multiple Assistant stream frames and tool-state updates for the same conversation item, so placing an unfinished item in `Static` freezes its first visible text or execution state. A synchronous fake adapter can finish before React commits the first render and conceal this failure.

## Decision

Keep the current turn's mutable history suffix outside `Static`. The conversation-to-history projection records the prefix length at turn start and updates that position with the projected history in the same effect. On completion, apply the final View Models before releasing the suffix into immutable static history. Preserve chronological order for local UI entries added during that turn. Alternate-buffer rendering remains responsive to every update.

## Alternatives

Changing item keys does not change Ink's index-based static cursor. Remounting the entire static tree would reprint earlier history and disrupt scrollback. Rendering all history dynamically would discard the ordinary terminal buffer's existing scrollback behavior.

## Consequences

Streaming text, reasoning, and tool results can update while the Agent works. Completed turns print once and remain stable when later turns start. DSH continues to own canonical events and completion; the terminal renderer only controls when its current presentation becomes immutable.

## Verification

Incremental rendering tests cover partial-to-final Assistant text, executing-to-completed tools, and preserving an earlier static prefix across later turns. The DSH PTY test uses asynchronous stream chunks and a terminal emulator to inspect visible final output. A separate real-provider smoke checks final terminal text, tool execution, persisted Session resume, and equality between live, replayed, and displayed usage.
