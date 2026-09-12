# Input surface and terminal margins

## Status

Implemented. Actual terminal visual acceptance remains a separate check from automated rendering tests.

## Context

iTerm2 can extend the background of the first and last cells into the window margins in alternate-screen mode. Half-block glyphs only paint inside the character grid, so a full-width input can appear wider on its content rows than on its top and bottom half rows. Its drawing code conditions this behavior on `extendBackgroundColorIntoMargins` and `softAlternateScreenMode`; see [iTermTextDrawingHelper](https://github.com/gnachman/iTerm2/blob/master/sources/Drawing/iTermTextDrawingHelper.m). A comparison with a primary-screen application does not exercise this behavior, even in the same terminal.

## Decision

Keep the full-width input and its existing one-cell side padding. Use the direct foreground half-block approach in [Gemini CLI](https://github.com/google-gemini/gemini-cli/blob/9c1b0a610534d6f8120964cf2672c07807d8fc90/packages/cli/src/ui/components/shared/HalfLinePaddedBox.tsx): lower halves above the content and upper halves below it, with native terminal background outside the glyphs. For the input, paint its existing side padding with full foreground blocks of the same color as the interior background. Edge cells retain default backgrounds, so terminal background extension has no colored background to extend.

`HalfLinePaddedBox.paintSidePadding` owns these decorative side cells. `InputPrompt` relinquishes its own horizontal padding only while the colored surface is active. Plain-line and unsupported-color fallbacks retain their previous padding. Message renderers keep their existing default behavior. Keep the custom border object stable and remount the content box if the padding mode changes: Ink 6.4 applies changed border styles separately from unchanged top/bottom flags, which can otherwise introduce unwanted rows on rerender.

## Alternatives

An outer one-column margin prevents extension but changes the visual width and text alignment. Disabling alternate-screen mode changes scrolling and terminal lifecycle behavior. Changing terminal preferences affects other applications. An Ink upgrade is broader than this issue and does not remove the terminal's alternate-screen margin rule. None is required for this fix.

## Consequences

The input keeps its original width, height, text origin, and mouse coordinates. No terminal-brand branch or terminal-preference mutation is needed. Decorative full blocks join the existing half blocks in raw terminal output; ANSI-stripped snapshots alone cannot prove that the cell backgrounds are correct.

Screen-reader mode bypasses the shared decorative surface and all input borders. A non-empty `NO_COLOR` also bypasses the surface, with the input retaining its plain-line fallback and padding; an empty value does not disable the surface. Both the shared component and input geometry honor these conditions so removing decorative side cells cannot shift the input into the terminal edge.

## Verification

The shared-component regression test parses colored output with `@xterm/headless` and checks default backgrounds at both edges, matching foreground/interior colors, multiline geometry, repeated redraws, and shrinking/growing widths. InputPrompt tests cover mouse positioning, paste interactions, completion, and color fallbacks. These checks prove character-cell output, not a particular terminal emulator's pixel rendering; visual acceptance in iTerm2 remains necessary.

Regression coverage also exercises truecolor, 256-color black/white backgrounds, 16 colors, screen-reader decoration suppression, and non-empty/empty `NO_COLOR` values. User-message snapshots track the shared half-block orientation without opting messages into the input-only side padding.
