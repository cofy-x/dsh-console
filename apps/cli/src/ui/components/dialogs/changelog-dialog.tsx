/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { theme } from '../../theme/colors.js';
import { DialogCloseAction } from '../shared/dialog-close-action.js';

interface ChangelogDialogProps {
  content: string;
  onClose: () => void;
}

type ChangelogLineKind = 'release' | 'section' | 'item' | 'text';

interface ChangelogLine {
  kind: ChangelogLineKind;
  text: string;
}

function wrapText(text: string, width: number): string[] {
  if (text.length === 0) return [''];

  const lines: string[] = [];
  let current = '';
  let currentWidth = 0;

  for (const character of text) {
    const characterWidth = stringWidth(character);
    if (current && currentWidth + characterWidth > width) {
      lines.push(current);
      current = character;
      currentWidth = characterWidth;
    } else {
      current += character;
      currentWidth += characterWidth;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function formatChangelog(content: string, width: number): ChangelogLine[] {
  const sourceLines = content.split(/\r?\n/);
  const firstRelease = sourceLines.findIndex((line) => line.startsWith('## '));
  let relevantLines =
    firstRelease >= 0 ? sourceLines.slice(firstRelease) : sourceLines;
  if (relevantLines[0]?.trim() === '## [Unreleased]') {
    const nextRelease = relevantLines.findIndex(
      (line, index) => index > 0 && line.startsWith('## '),
    );
    const unreleasedEnd = nextRelease < 0 ? relevantLines.length : nextRelease;
    const unreleasedIsEmpty = relevantLines
      .slice(1, unreleasedEnd)
      .every((line) => line.trim().length === 0);
    if (unreleasedIsEmpty) relevantLines = relevantLines.slice(unreleasedEnd);
  }
  const result: ChangelogLine[] = [];

  for (const sourceLine of relevantLines) {
    if (/^\[[^\]]+\]:\s/.test(sourceLine)) continue;

    let kind: ChangelogLineKind = 'text';
    let text = sourceLine;
    let firstPrefix = '';
    let continuationPrefix = '';

    if (sourceLine.startsWith('## ')) {
      kind = 'release';
      text = sourceLine.slice(3);
    } else if (sourceLine.startsWith('### ')) {
      kind = 'section';
      text = sourceLine.slice(4);
    } else if (sourceLine.startsWith('- ')) {
      kind = 'item';
      text = sourceLine.slice(2);
      firstPrefix = '• ';
      continuationPrefix = '  ';
    }

    const availableWidth = Math.max(1, width - stringWidth(firstPrefix));
    wrapText(text, availableWidth).forEach((line, index) => {
      result.push({
        kind,
        text: `${index === 0 ? firstPrefix : continuationPrefix}${line}`,
      });
    });
  }

  return result;
}

export function ChangelogDialog({
  content,
  onClose,
}: ChangelogDialogProps): React.JSX.Element {
  const { terminalWidth, terminalHeight } = useUIState();
  const viewportHeight = Math.max(1, Math.min(24, terminalHeight - 5));
  const contentWidth = Math.max(2, terminalWidth - 4);
  const closeLabel = terminalWidth >= 24 ? 'Esc to close' : 'Esc';
  const scrollLabel =
    terminalWidth >= 48
      ? '↑/↓ scroll · PgUp/PgDn page'
      : terminalWidth >= 28
        ? '↑/↓ scroll'
        : '';
  const lines = useMemo(
    () => formatChangelog(content, contentWidth),
    [content, contentWidth],
  );
  const maxOffset = Math.max(0, lines.length - viewportHeight);
  const [offset, setOffset] = useState(0);
  const visibleOffset = Math.min(offset, maxOffset);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
        return;
      }
      if (key.name === 'up') setOffset((value) => Math.max(0, value - 1));
      if (key.name === 'down') {
        setOffset((value) => Math.min(maxOffset, value + 1));
      }
      if (key.name === 'pageup') {
        setOffset((value) =>
          Math.max(0, value - Math.max(1, viewportHeight - 1)),
        );
      }
      if (key.name === 'pagedown') {
        setOffset((value) =>
          Math.min(maxOffset, value + Math.max(1, viewportHeight - 1)),
        );
      }
      if (key.name === 'home') setOffset(0);
      if (key.name === 'end') setOffset(maxOffset);
    },
    { isActive: true },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold>Changelog</Text>
        <DialogCloseAction onClose={onClose} label={closeLabel} />
      </Box>
      <Box flexDirection="column" marginTop={1} height={viewportHeight}>
        {lines
          .slice(visibleOffset, visibleOffset + viewportHeight)
          .map((line, index) => {
            if (line.kind === 'release') {
              return (
                <Text
                  key={`${visibleOffset}-${index}`}
                  bold
                  color={theme.text.accent}
                >
                  {line.text}
                </Text>
              );
            }
            if (line.kind === 'section') {
              return (
                <Text
                  key={`${visibleOffset}-${index}`}
                  bold
                  color={theme.text.link}
                >
                  {line.text}
                </Text>
              );
            }
            return (
              <Text
                key={`${visibleOffset}-${index}`}
                color={
                  line.kind === 'item'
                    ? theme.text.primary
                    : theme.text.secondary
                }
              >
                {line.text}
              </Text>
            );
          })}
      </Box>
      <Box justifyContent="space-between">
        <Text color={theme.text.secondary}>{scrollLabel}</Text>
        <Text color={theme.text.secondary}>
          {lines.length === 0
            ? '0 / 0'
            : `${visibleOffset + 1} / ${lines.length}`}
        </Text>
      </Box>
    </Box>
  );
}
