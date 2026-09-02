/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { MarkdownDisplay } from '../markdown/markdown-display.js';
import { theme } from '../../theme/colors.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useAlternateBuffer } from '../../hooks/terminal/use-alternate-buffer.js';
import { useSettings } from '../../contexts/settings-context.js';
import type {
  ConversationContentBlock,
  ConversationTurnMetrics,
} from '../../conversation-runtime.js';
import { ExtensionContentBlock } from './extension-content-block.js';
import { escapeAnsiCtrlCodes } from '../../../text/processing.js';
import { ReasoningBlock } from './reasoning-block.js';
import { normalizeReasoningDisplayMode } from '../../reasoning-display.js';
import { TurnMetricsDisplay } from './turn-metrics-display.js';

interface ConversationContentProps {
  content: readonly ConversationContentBlock[];
  terminalWidth: number;
  availableTerminalHeight?: number;
  pending?: boolean;
  interrupted?: boolean;
}

const ImageAttachmentBlock: React.FC<{
  block: Extract<ConversationContentBlock, { type: 'image' }>;
}> = ({ block }) => {
  const { attachment } = block;
  const name = attachment.name ?? attachment.attachmentId;
  const size = `${attachment.width}x${attachment.height}`;
  const bytes = `${String(attachment.bytes)} bytes`;
  const originalSize = attachment.originalDimensions;
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
    >
      <Text bold color={theme.text.primary}>
        Attachment: {name}
      </Text>
      <Text color={theme.text.secondary}>
        {attachment.mediaType} · {size} · {bytes}
      </Text>
      {originalSize &&
        (originalSize.width !== attachment.width ||
          originalSize.height !== attachment.height) && (
          <Text color={theme.text.secondary}>
            Original: {String(originalSize.width)}x{String(originalSize.height)}
          </Text>
        )}
    </Box>
  );
};

export const ConversationContent: React.FC<ConversationContentProps> = ({
  content,
  terminalWidth,
  availableTerminalHeight,
  pending = false,
  interrupted = false,
}) => {
  const { renderMarkdown } = useUIState();
  const isAlternateBuffer = useAlternateBuffer();
  const reasoningMode = normalizeReasoningDisplayMode(
    useSettings().merged.ui.reasoningDisplay,
  );
  return (
    <Box flexDirection="column">
      {content.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              <MarkdownDisplay
                key={index}
                text={block.text}
                isPending={false}
                availableTerminalHeight={
                  isAlternateBuffer ? undefined : availableTerminalHeight
                }
                terminalWidth={terminalWidth}
                renderMarkdown={renderMarkdown}
              />
            );
          case 'reasoning':
            if (reasoningMode === 'hidden') return null;
            return (
              <ReasoningBlock
                key={index}
                text={block.text}
                terminalWidth={terminalWidth}
                mode={reasoningMode}
                pending={pending}
                interrupted={interrupted}
                separateFromPrecedingContent={
                  index > 0 && content[index - 1]?.type !== 'reasoning'
                }
                separateFromFollowingContent={
                  index < content.length - 1 &&
                  content[index + 1]?.type !== 'reasoning'
                }
              />
            );
          case 'image':
            return <ImageAttachmentBlock key={index} block={block} />;
          case 'tool-call':
            return (
              <Box
                key={index}
                flexDirection="column"
                borderStyle="round"
                borderColor={theme.border.default}
                paddingX={1}
              >
                <Text bold>Tool request: {block.name}</Text>
                <Text color={theme.text.secondary}>
                  {escapeAnsiCtrlCodes(block.arguments).slice(0, 12_000)}
                </Text>
              </Box>
            );
          case 'extension':
            return <ExtensionContentBlock key={index} block={block} />;
          default:
            return null;
        }
      })}
    </Box>
  );
};

export const ConversationMessage: React.FC<
  ConversationContentProps & {
    interrupted?: boolean;
    role?: 'user' | 'assistant';
    pending?: boolean;
    turnMetrics?: ConversationTurnMetrics;
  }
> = ({
  content,
  interrupted = false,
  role = 'assistant',
  pending = false,
  turnMetrics,
  terminalWidth,
  availableTerminalHeight,
}) => (
  <Box flexDirection="row">
    <Box width={2}>
      <Text color={role === 'assistant' ? theme.text.accent : undefined}>
        {role === 'assistant' ? '✦ ' : '> '}
      </Text>
    </Box>
    <Box flexGrow={1} flexDirection="column">
      <ConversationContent
        content={content}
        terminalWidth={terminalWidth - 2}
        availableTerminalHeight={availableTerminalHeight}
        pending={role === 'assistant' && pending}
        interrupted={role === 'assistant' && interrupted}
      />
      {role === 'assistant' && interrupted && (
        <Text color={theme.status.warning}>
          Response interrupted before completion.
        </Text>
      )}
      {role === 'assistant' && !pending && turnMetrics !== undefined && (
        <TurnMetricsDisplay
          metrics={turnMetrics}
          terminalWidth={terminalWidth - 2}
        />
      )}
    </Box>
  </Box>
);
