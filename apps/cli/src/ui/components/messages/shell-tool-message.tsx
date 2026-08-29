/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, type DOMElement } from 'ink';
import { ShellInputPrompt } from '../input/shell-input-prompt.js';
import { StickyHeader } from '../layout/sticky-header.js';
import { useUIActions } from '../../contexts/ui-actions-context.js';
import { useMouseClick } from '../../hooks/input/use-mouse-click.js';
import { useMouseContext } from '../../contexts/mouse-context.js';
import { ToolResultDisplay } from './tool-result-display.js';
import {
  ToolStatusIndicator,
  ToolInfo,
  TrailingIndicator,
  STATUS_INDICATOR_WIDTH,
  isThisShellFocusable as checkIsShellFocusable,
  isThisShellFocused as checkIsShellFocused,
  useFocusHint,
  FocusHint,
  isToolTitleCollapsible,
} from './tool-shared.js';
import type { ToolMessageProps } from './tool-message.js';
import type { Config } from '../../../config/config.js';
import { escapeAnsiCtrlCodes } from '../../../text/processing.js';

export interface ShellToolMessageProps extends ToolMessageProps {
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  config?: Config;
}

export const ShellToolMessage: React.FC<ShellToolMessageProps> = ({
  name,
  description,
  arguments: argumentsText,
  resultDisplay,
  status,
  availableTerminalHeight,
  terminalWidth,
  emphasis = 'medium',
  renderOutputAsMarkdown = true,
  activeShellPtyId,
  embeddedShellFocused,
  ptyId,
  config,
  isFirst,
  borderColor,
  borderDimColor,
  resultExpanded = false,
  resultCollapsible = false,
  onToggleResult,
}) => {
  const { mouseEventsEnabled } = useMouseContext();
  const title = React.useMemo(
    () =>
      escapeAnsiCtrlCodes(
        argumentsText === undefined && description
          ? `${name} ${description}`
          : name,
      ),
    [argumentsText, description, name],
  );
  const commandCollapsible = isToolTitleCollapsible(title, terminalWidth);
  const [commandExpandedByUser, setCommandExpandedByUser] =
    React.useState(false);
  const isThisShellFocused = checkIsShellFocused(
    name,
    status,
    ptyId,
    activeShellPtyId,
    embeddedShellFocused,
  );

  const { setEmbeddedShellFocused } = useUIActions();

  const headerRef = React.useRef<DOMElement>(null);
  const contentRef = React.useRef<DOMElement>(null);

  // The shell is focusable if it's the shell command, it's executing, and the interactive shell is enabled.

  const isThisShellFocusable = checkIsShellFocusable(name, status, config);
  const commandExpanded =
    commandCollapsible &&
    !isThisShellFocusable &&
    (!mouseEventsEnabled || commandExpandedByUser);

  const handleFocus = React.useCallback(() => {
    if (isThisShellFocusable) {
      setEmbeddedShellFocused(true);
    }
  }, [isThisShellFocusable, setEmbeddedShellFocused]);

  const handleHeaderClick = React.useCallback(() => {
    if (isThisShellFocusable) {
      handleFocus();
      return;
    }
    if (commandCollapsible && mouseEventsEnabled) {
      setCommandExpandedByUser((expanded) => !expanded);
    }
  }, [
    commandCollapsible,
    handleFocus,
    isThisShellFocusable,
    mouseEventsEnabled,
  ]);

  const handleContentClick = () => {
    if (isThisShellFocusable) {
      handleFocus();
    }
    onToggleResult?.();
  };

  useMouseClick(headerRef, handleHeaderClick, {
    isActive:
      !!isThisShellFocusable || (commandCollapsible && mouseEventsEnabled),
  });

  useMouseClick(contentRef, handleContentClick, {
    isActive: !!isThisShellFocusable || resultCollapsible,
  });

  const wasFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (isThisShellFocused) {
      wasFocusedRef.current = true;
    } else if (wasFocusedRef.current) {
      if (embeddedShellFocused) {
        setEmbeddedShellFocused(false);
      }

      wasFocusedRef.current = false;
    }
  }, [isThisShellFocused, embeddedShellFocused, setEmbeddedShellFocused]);

  const { shouldShowFocusHint } = useFocusHint(
    isThisShellFocusable,
    isThisShellFocused,
    resultDisplay,
  );

  return (
    <>
      <StickyHeader
        width={terminalWidth}
        isFirst={isFirst}
        borderColor={borderColor}
        borderDimColor={borderDimColor}
        containerRef={headerRef}
      >
        <ToolStatusIndicator status={status} name={name} />

        <ToolInfo
          name={title}
          status={status}
          description=""
          emphasis={emphasis}
          hideDescription
          maxNameWidth={
            commandCollapsible && !commandExpanded
              ? Math.max(1, terminalWidth - STATUS_INDICATOR_WIDTH - 4)
              : undefined
          }
          expandTitle={commandExpanded}
        />

        <FocusHint
          shouldShowFocusHint={shouldShowFocusHint}
          isThisShellFocused={isThisShellFocused}
        />

        {emphasis === 'high' && <TrailingIndicator />}
      </StickyHeader>

      <Box
        ref={contentRef}
        width={terminalWidth}
        borderStyle="round"
        borderColor={borderColor}
        borderDimColor={borderDimColor}
        borderTop={false}
        borderBottom={false}
        borderLeft={true}
        borderRight={true}
        paddingX={1}
        flexDirection="column"
      >
        <Box flexDirection="column">
          <ToolResultDisplay
            resultDisplay={resultDisplay}
            availableTerminalHeight={availableTerminalHeight}
            terminalWidth={terminalWidth}
            renderOutputAsMarkdown={renderOutputAsMarkdown}
            collapsed={resultCollapsible && !resultExpanded}
            canToggle={resultCollapsible}
          />
        </Box>
        {isThisShellFocused && config && (
          <Box paddingLeft={STATUS_INDICATOR_WIDTH} marginTop={1}>
            <ShellInputPrompt
              activeShellPtyId={activeShellPtyId ?? null}
              focus={embeddedShellFocused}
            />
          </Box>
        )}
      </Box>
    </>
  );
};
