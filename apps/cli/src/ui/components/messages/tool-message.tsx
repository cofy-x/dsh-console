/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, type DOMElement } from 'ink';
import type { IndividualToolCallDisplay } from '../../types.js';
import { StickyHeader } from '../layout/sticky-header.js';
import { ToolResultDisplay } from './tool-result-display.js';
import {
  ToolStatusIndicator,
  ToolInfo,
  TrailingIndicator,
  type TextEmphasis,
  STATUS_INDICATOR_WIDTH,
  isThisShellFocusable as checkIsShellFocusable,
  isThisShellFocused as checkIsShellFocused,
  useFocusHint,
  FocusHint,
  isToolTitleCollapsible,
} from './tool-shared.js';
import type { Config } from '../../../config/config.js';
import { ShellInputPrompt } from '../input/shell-input-prompt.js';
import { useMouseClick } from '../../hooks/input/use-mouse-click.js';
import { useMouseContext } from '../../contexts/mouse-context.js';
import { escapeAnsiCtrlCodes } from '../../../text/processing.js';

export type { TextEmphasis };

export interface ToolMessageProps extends IndividualToolCallDisplay {
  availableTerminalHeight?: number;
  terminalWidth: number;
  emphasis?: TextEmphasis;
  renderOutputAsMarkdown?: boolean;
  isFirst: boolean;
  borderColor: string;
  borderDimColor: boolean;
  activeShellPtyId?: number | null;
  embeddedShellFocused?: boolean;
  ptyId?: number;
  config?: Config;
  resultExpanded?: boolean;
  resultCollapsible?: boolean;
  onToggleResult?: () => void;
}

export const ToolMessage: React.FC<ToolMessageProps> = ({
  name,
  description,
  arguments: argumentsText,
  resultDisplay,
  status,
  availableTerminalHeight,
  terminalWidth,
  emphasis = 'medium',
  renderOutputAsMarkdown = true,
  isFirst,
  borderColor,
  borderDimColor,
  activeShellPtyId,
  embeddedShellFocused,
  ptyId,
  config,
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
  const detailsCollapsible = isToolTitleCollapsible(title, terminalWidth);
  const [detailsExpandedByUser, setDetailsExpandedByUser] =
    React.useState(false);
  const detailsExpanded =
    detailsCollapsible && (!mouseEventsEnabled || detailsExpandedByUser);
  const headerRef = React.useRef<DOMElement>(null);
  const contentRef = React.useRef<DOMElement>(null);
  const handleHeaderClick = React.useCallback(() => {
    if (detailsCollapsible && mouseEventsEnabled) {
      setDetailsExpandedByUser((expanded) => !expanded);
    }
  }, [detailsCollapsible, mouseEventsEnabled]);
  useMouseClick(headerRef, handleHeaderClick, {
    isActive: detailsCollapsible && mouseEventsEnabled,
  });
  useMouseClick(contentRef, () => onToggleResult?.(), {
    isActive: resultCollapsible && onToggleResult !== undefined,
  });
  const isThisShellFocused = checkIsShellFocused(
    name,
    status,
    ptyId,
    activeShellPtyId,
    embeddedShellFocused,
  );

  const isThisShellFocusable = checkIsShellFocusable(name, status, config);

  const { shouldShowFocusHint } = useFocusHint(
    isThisShellFocusable,
    isThisShellFocused,
    resultDisplay,
  );

  return (
    // It is crucial we don't replace this <> with a Box because otherwise the
    // sticky header inside it would be sticky to that box rather than to the
    // parent component of this ToolMessage.
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
            detailsCollapsible && mouseEventsEnabled && !detailsExpanded
              ? Math.max(1, terminalWidth - STATUS_INDICATOR_WIDTH - 4)
              : undefined
          }
          expandTitle={detailsExpanded}
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
