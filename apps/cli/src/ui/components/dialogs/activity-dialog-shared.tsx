/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import stripAnsi from 'strip-ansi';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { useTextBuffer } from '../../hooks/input/use-text-buffer.js';
import { theme } from '../../theme/colors.js';
import { TextInput } from '../shared/text-input.js';
import { DialogCloseAction } from '../shared/dialog-close-action.js';

export function plainPanelText(text: string): string {
  return stripAnsi(text).replace(/[\p{Cc}\p{Cf}]/gu, (character) =>
    character === '\n' || character === '\t' ? character : '',
  );
}

/** Safe text for one-line controls and labels. */
export function plainPanelLine(text: string): string {
  return plainPanelText(text).replace(/\s+/gu, ' ').trim();
}

export function ActivityPanel({
  title,
  children,
  onClose,
  busy = false,
  cancelable = false,
  error,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
  busy?: boolean;
  cancelable?: boolean;
  error?: string;
}) {
  return (
    <Box
      width="100%"
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={theme.text.primary}>
          {title}
        </Text>
        <DialogCloseAction onClose={onClose} isActive={!busy || cancelable} />
      </Box>
      {error && <Text color={theme.status.error}>{plainPanelText(error)}</Text>}
      {busy && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Working...</Text>
        </Box>
      )}
      {children}
    </Box>
  );
}

export function PanelInput({
  initial = '',
  label,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  label: string;
  onSubmit(value: string): void;
  onCancel(): void;
}) {
  const { terminalWidth } = useUIState();
  const buffer = useTextBuffer({
    initialText: initial,
    initialCursorOffset: initial.length,
    viewport: { width: Math.max(12, terminalWidth - 8), height: 3 },
    isValidPath: () => false,
    singleLine: true,
  });
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.text.secondary}>{label}</Text>
      <TextInput buffer={buffer} onSubmit={onSubmit} onCancel={onCancel} />
      <Text color={theme.text.secondary}>
        Enter to continue; Esc to go back.
      </Text>
    </Box>
  );
}

/** Bounded, paged plain-text preview; never interpret terminal control sequences. */
export function PanelPreview({
  text,
  active = true,
  fullWidth = false,
}: {
  text: string;
  active?: boolean;
  fullWidth?: boolean;
}) {
  const { terminalWidth } = useUIState();
  const [page, setPage] = useState(0);
  const height = Math.max(3, Math.min(8, (process.stdout.rows ?? 24) - 16));
  const width = Math.max(
    6,
    fullWidth ? terminalWidth - 12 : Math.floor((terminalWidth - 8) / 2),
  );
  const lines = useMemo(
    () =>
      plainPanelText(text)
        .split('\n')
        .flatMap((line) => {
          const chars = Array.from(line.replaceAll('\t', '  '));
          if (chars.length === 0) return [''];
          const rows: string[] = [];
          for (let index = 0; index < chars.length; index += width)
            rows.push(chars.slice(index, index + width).join(''));
          return rows;
        }),
    [text, width],
  );
  const pages = Math.max(1, Math.ceil(lines.length / height));
  const current = Math.min(page, pages - 1);
  useKeypress(
    (key) => {
      if (key.name === 'pageup') setPage(Math.max(0, current - 1));
      if (key.name === 'pagedown') setPage(Math.min(pages - 1, current + 1));
    },
    { isActive: active },
  );
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        {lines.slice(current * height, (current + 1) * height).join('\n')}
      </Text>
      {pages > 1 && (
        <Text color={theme.text.secondary}>
          PgUp/PgDn: {current + 1}/{pages}
        </Text>
      )}
    </Box>
  );
}
