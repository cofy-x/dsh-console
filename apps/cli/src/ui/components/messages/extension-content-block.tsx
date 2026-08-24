/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import type { ConversationExtensionBlock } from '../../conversation-runtime.js';
import { escapeAnsiCtrlCodes } from '../../../text/processing.js';
import { theme } from '../../theme/colors.js';

export interface ExtensionContentRendererProps {
  block: ConversationExtensionBlock;
}

export type ExtensionContentRenderer = React.ComponentType<
  ExtensionContentRendererProps
>;

const renderers = new Map<string, ExtensionContentRenderer>();
const MAX_FALLBACK_CHARACTERS = 12_000;

export function registerExtensionContentRenderer(
  blockType: string,
  renderer: ExtensionContentRenderer,
): () => void {
  renderers.set(blockType, renderer);
  return () => {
    if (renderers.get(blockType) === renderer) renderers.delete(blockType);
  };
}

function safePayload(payload: unknown): string {
  let value: string;
  try {
    value = JSON.stringify(payload, null, 2) ?? String(payload);
  } catch {
    value = String(payload);
  }
  const escaped = escapeAnsiCtrlCodes(value);
  return escaped.length <= MAX_FALLBACK_CHARACTERS
    ? escaped
    : `${escaped.slice(0, MAX_FALLBACK_CHARACTERS)}\n… truncated`;
}

export const ExtensionContentBlock: React.FC<ExtensionContentRendererProps> = ({
  block,
}) => {
  const Renderer = renderers.get(block.blockType);
  if (Renderer !== undefined) return <Renderer block={block} />;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border.default} paddingX={1}>
      <Text bold color={theme.text.secondary}>DSH content: {block.blockType}</Text>
      <Text color={theme.text.primary}>{safePayload(block.payload)}</Text>
    </Box>
  );
};
