/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, type DOMElement } from 'ink';
import { MarkdownDisplay } from '../markdown/markdown-display.js';
import { theme } from '../../theme/colors.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import type { ReasoningDisplayMode } from '../../reasoning-display.js';
import { useMouseClick } from '../../hooks/input/use-mouse-click.js';

const AUTO_PREVIEW_LINES = 4;

function preview(text: string, terminalWidth: number): string {
  const lines = text.trimEnd().split('\n');
  const recent = lines.slice(-AUTO_PREVIEW_LINES).join('\n');
  const characterBudget = Math.max(80, Math.min(terminalWidth, 110) * AUTO_PREVIEW_LINES);
  return recent.length > characterBudget
    ? `...${recent.slice(-characterBudget)}`
    : recent;
}

export interface ReasoningBlockProps {
  text: string;
  terminalWidth: number;
  mode: ReasoningDisplayMode;
  pending: boolean;
  interrupted: boolean;
  separateFromPrecedingContent?: boolean;
  separateFromFollowingContent?: boolean;
}

export const ReasoningBlock: React.FC<ReasoningBlockProps> = ({
  text,
  terminalWidth,
  mode,
  pending,
  interrupted,
  separateFromPrecedingContent = false,
  separateFromFollowingContent = false,
}) => {
  const { renderMarkdown } = useUIState();
  const containerRef = React.useRef<DOMElement>(null);
  const defaultExpanded = mode === 'expanded' || (mode === 'auto' && pending);
  const [expandedOverride, setExpandedOverride] = useState<boolean>();

  useEffect(() => {
    setExpandedOverride(undefined);
  }, [mode]);

  const expanded = expandedOverride ?? defaultExpanded;
  useMouseClick(
    containerRef,
    () => setExpandedOverride((current) => !(current ?? defaultExpanded)),
    { isActive: mode !== 'hidden' && text !== '' },
  );

  if (mode === 'hidden') return null;

  const lineCount = text === '' ? 0 : text.split('\n').length;
  const title = interrupted
    ? 'Thinking interrupted'
    : pending
      ? 'Thinking...'
      : 'Thought';

  return (
    <Box
      ref={containerRef}
      flexDirection="column"
      borderStyle="single"
      borderTop={false}
      borderRight={false}
      borderBottom={false}
      borderColor={interrupted ? theme.status.warning : theme.border.default}
      paddingLeft={1}
      marginTop={separateFromPrecedingContent ? 1 : 0}
      marginBottom={separateFromFollowingContent ? 1 : 0}
    >
      <Text bold dimColor color={interrupted ? theme.status.warning : theme.text.secondary}>
        {title}
        {text !== '' &&
          ` | ${String(lineCount)} ${lineCount === 1 ? 'line' : 'lines'} | ${expanded ? 'click to collapse' : 'collapsed | click to expand'}`}
      </Text>
      {expanded && text !== '' && (
        <MarkdownDisplay
          text={mode === 'auto' && expandedOverride === undefined ? preview(text, terminalWidth) : text}
          terminalWidth={Math.max(1, terminalWidth - 2)}
          renderMarkdown={renderMarkdown}
          isPending={pending}
        />
      )}
    </Box>
  );
};
