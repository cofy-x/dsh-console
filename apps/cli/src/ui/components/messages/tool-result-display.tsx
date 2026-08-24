/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { DiffRenderer } from './diff-renderer.js';
import { MarkdownDisplay } from '../markdown/markdown-display.js';
import { AnsiOutputText } from '../shared/ansi-output.js';
import { MaxSizedBox } from '../shared/max-sized-box.js';
import { theme } from '../../theme/colors.js';
import type { ToolResultDisplay as ToolResultDisplayType } from '../../tool-result.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { tryParseJSON } from '../../../text/jsonoutput.js';
import { ConversationContent } from './conversation-message.js';
import { conversationContentText } from '../../conversation-runtime.js';
import stringWidth from 'string-width';

const STATIC_HEIGHT = 1;
const RESERVED_LINE_COUNT = 5; // for tool name, status, padding etc.
const MIN_LINES_SHOWN = 2; // show at least this many lines

// Large threshold to ensure we don't cause performance issues for very large
// outputs that will get truncated further MaxSizedBox anyway.
const MAXIMUM_RESULT_DISPLAY_CHARACTERS = 20000;
export const TOOL_RESULT_COLLAPSE_THRESHOLD = 12;
export const TOOL_RESULT_PREVIEW_LINES = 8;

function wrappedLineCount(text: string, width: number): number {
  const safeWidth = Math.max(1, width);
  return text.split(/\r?\n/).reduce(
    (total, line) => total + Math.max(1, Math.ceil(stringWidth(line) / safeWidth)),
    0,
  );
}

function wrappedLines(
  values: readonly string[],
  width: number,
): number {
  return values.reduce(
    (total, value) => total + wrappedLineCount(value, width),
    0,
  );
}

export function getToolResultLineCount(
  result: ToolResultDisplayType | undefined,
  width: number,
): number {
  if (result === undefined) return 0;
  switch (result.type) {
    case 'text': {
      const limited = result.content.length > MAXIMUM_RESULT_DISPLAY_CHARACTERS
        ? `...${result.content.slice(-MAXIMUM_RESULT_DISPLAY_CHARACTERS)}`
        : result.content;
      const json = tryParseJSON(limited);
      return wrappedLineCount(json ? JSON.stringify(json, null, 2) : limited, width);
    }
    case 'diff':
      return wrappedLineCount(result.content.fileDiff, width);
    case 'dsh-content':
      return wrappedLineCount(conversationContentText(result.content), width) +
        (result.error === undefined ? 0 : 1);
    case 'terminal':
      return (result.output ? wrappedLineCount(result.output, width) : 0) +
        (result.exitCode !== undefined || result.signal ? 1 : 0);
    case 'read':
      return wrappedLineCount(
        `${result.path} (${String(result.lines.length)} of ${String(result.totalLines)} lines)`,
        width,
      ) + wrappedLines(
        result.lines.map(
          (line) => `${String(line.number).padStart(5)} ${line.text}`,
        ),
        width,
      );
    case 'search-paths':
      return wrappedLines(result.paths, width) + (result.truncated ? 1 : 0);
    case 'search-matches':
      return result.files.reduce(
        (total, file) =>
          total +
          wrappedLineCount(file.path, width) +
          wrappedLines(
            file.matches.map(
              (match) => `${String(match.lineNumber)}: ${match.line}`,
            ),
            width,
          ),
        0,
      ) + (result.truncated ? 1 : 0);
    case 'web-search':
      return (result.answer ? wrappedLineCount(result.answer, width) : 0) +
        result.sources.reduce(
          (total, source) =>
            total +
            wrappedLineCount(
              `${source.title ?? source.url} - ${source.url}`,
              width,
            ) +
            (source.snippet
              ? wrappedLineCount(source.snippet, width)
              : 0) +
            (source.publishedAt
              ? wrappedLineCount(source.publishedAt, width)
              : 0),
          0,
        ) + (result.truncated ? 1 : 0);
    case 'web-fetch':
      return wrappedLineCount(
        `${String(result.statusCode)} ${result.url}${result.truncated ? ' (truncated)' : ''}`,
        width,
      );
    case 'ansi':
      return result.content.length;
    case 'todo':
      return 0;
    default:
      return 0;
  }
}

export function isToolResultCollapsible(
  result: ToolResultDisplayType | undefined,
  width: number,
): boolean {
  return getToolResultLineCount(result, width) > TOOL_RESULT_COLLAPSE_THRESHOLD;
}

export interface ToolResultDisplayProps {
  resultDisplay: ToolResultDisplayType | undefined;
  availableTerminalHeight?: number;
  terminalWidth: number;
  renderOutputAsMarkdown?: boolean;
  collapsed?: boolean;
  canToggle?: boolean;
}

export const ToolResultDisplay: React.FC<ToolResultDisplayProps> = ({
  resultDisplay,
  availableTerminalHeight,
  terminalWidth,
  renderOutputAsMarkdown = true,
  collapsed = false,
  canToggle = false,
}) => {
  const { renderMarkdown } = useUIState();

  const availableHeight = availableTerminalHeight
    ? Math.max(
        availableTerminalHeight - STATIC_HEIGHT - RESERVED_LINE_COUNT,
        MIN_LINES_SHOWN + 1, // enforce minimum lines shown
      )
    : undefined;

  const combinedPaddingAndBorderWidth = 4;
  const childWidth = Math.max(
    1,
    terminalWidth - combinedPaddingAndBorderWidth,
  );
  const lineCount = getToolResultLineCount(resultDisplay, childWidth);
  const collapsible = lineCount > TOOL_RESULT_COLLAPSE_THRESHOLD;
  const constrainedHeight = collapsed && collapsible
    ? Math.min(availableHeight ?? TOOL_RESULT_PREVIEW_LINES, TOOL_RESULT_PREVIEW_LINES)
    : availableHeight;

  // Memoize truncated text content to avoid re-computing on every render
  const truncatedTextContent = React.useMemo(() => {
    if (resultDisplay?.type === 'text') {
      const content = resultDisplay.content;
      if (content.length > MAXIMUM_RESULT_DISPLAY_CHARACTERS) {
        return '...' + content.slice(-MAXIMUM_RESULT_DISPLAY_CHARACTERS);
      }
      return content;
    }
    return null;
  }, [resultDisplay]);

  if (!resultDisplay) return null;

  const renderContent = () => {
    switch (resultDisplay.type) {
      case 'text': {
        const textContent = truncatedTextContent!;

        // Check if string content is valid JSON and pretty-print it
        const prettyJSON = tryParseJSON(textContent);
        const formattedJSON = prettyJSON
          ? JSON.stringify(prettyJSON, null, 2)
          : null;

        if (formattedJSON) {
          return (
            <Text wrap="wrap" color={theme.text.primary}>
              {formattedJSON}
            </Text>
          );
        }

        if (renderOutputAsMarkdown) {
          return (
            <MarkdownDisplay
              text={textContent}
              terminalWidth={childWidth}
              renderMarkdown={renderMarkdown}
              isPending={false}
            />
          );
        } else {
          return (
            <Text wrap="wrap" color={theme.text.primary}>
              {textContent}
            </Text>
          );
        }
      }

      case 'diff':
        return (
          <DiffRenderer
            diffContent={resultDisplay.content.fileDiff}
            filename={resultDisplay.content.fileName}
            availableTerminalHeight={availableHeight}
            terminalWidth={childWidth}
          />
        );

      case 'dsh-content':
        return (
          <Box flexDirection="column">
            <ConversationContent
              content={resultDisplay.content}
              terminalWidth={childWidth}
              availableTerminalHeight={availableHeight}
            />
            {resultDisplay.error && (
              <Text color={theme.status.error}>
                {resultDisplay.error.code}: {resultDisplay.error.name}
              </Text>
            )}
          </Box>
        );

      case 'terminal':
        return (
          <Box flexDirection="column">
            {resultDisplay.output && <Text>{resultDisplay.output}</Text>}
            {(resultDisplay.exitCode !== undefined || resultDisplay.signal) && (
              <Text color={resultDisplay.exitCode === 0 ? theme.status.success : theme.status.error}>
                {resultDisplay.signal ?? `exit ${String(resultDisplay.exitCode)}`}
              </Text>
            )}
          </Box>
        );

      case 'read':
        return (
          <Box flexDirection="column">
            <Text bold>{resultDisplay.path} ({String(resultDisplay.lines.length)} of {String(resultDisplay.totalLines)} lines{resultDisplay.lang ? `, ${resultDisplay.lang}` : ''})</Text>
            {resultDisplay.lines.map((line) => (
              <Text key={line.number}><Text dimColor>{String(line.number).padStart(5)} </Text>{line.text}</Text>
            ))}
          </Box>
        );

      case 'search-paths':
        return (
          <Box flexDirection="column">
            {resultDisplay.paths.map((path) => <Text key={path}>{path}</Text>)}
            {resultDisplay.truncated && <Text dimColor>Showing {String(resultDisplay.paths.length)} of {String(resultDisplay.total)} paths.</Text>}
          </Box>
        );

      case 'search-matches':
        return (
          <Box flexDirection="column">
            {resultDisplay.files.map((file) => (
              <Box key={file.path} flexDirection="column">
                <Text bold>{file.path}</Text>
                {file.matches.map((match) => <Text key={match.lineNumber}><Text dimColor>{String(match.lineNumber)}: </Text>{match.line}</Text>)}
              </Box>
            ))}
            {resultDisplay.truncated && <Text dimColor>Results truncated ({String(resultDisplay.total)} total matches).</Text>}
          </Box>
        );

      case 'web-search':
        return (
          <Box flexDirection="column">
            {resultDisplay.answer && <Text>{resultDisplay.answer}</Text>}
            {resultDisplay.sources.map((source) => (
              <Box key={source.url} flexDirection="column">
                <Text>• {source.title ?? source.url} - {source.url}</Text>
                {source.snippet && <Text dimColor>{source.snippet}</Text>}
                {source.publishedAt && <Text dimColor>{source.publishedAt}</Text>}
              </Box>
            ))}
            {resultDisplay.truncated && <Text dimColor>Source list truncated.</Text>}
          </Box>
        );

      case 'web-fetch':
        return <Text>{String(resultDisplay.statusCode)} {resultDisplay.url}{resultDisplay.truncated ? ' (truncated)' : ''}</Text>;

      case 'todo':
        // display nothing, as the TodoTray will handle rendering todos
        return null;

      case 'ansi':
        return (
          <AnsiOutputText
            data={resultDisplay.content}
            availableTerminalHeight={availableHeight}
            width={childWidth}
          />
        );

      default:
        return null;
    }
  };

  const content = renderContent();
  if (!content) return null;

  return (
    <Box width={childWidth} flexDirection="column">
      <MaxSizedBox maxHeight={constrainedHeight} maxWidth={childWidth}>
        {content}
      </MaxSizedBox>
      {collapsible && canToggle && (
        <Text color={theme.text.secondary} wrap="truncate">
          {String(lineCount)} lines | {collapsed ? 'collapsed' : 'expanded'} |{' '}
          click to {collapsed ? 'expand' : 'collapse'}
        </Text>
      )}
    </Box>
  );
};
