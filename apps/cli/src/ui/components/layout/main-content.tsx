/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Static } from 'ink';
import { HistoryItemDisplay } from '../session/history-item-display.js';
import { ShowMoreLines } from '../shared/show-more-lines.js';
import { OverflowProvider } from '../../contexts/overflow-context.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useAppContext } from '../../contexts/app-context.js';
import { AppHeader } from './app-header.js';
import { useAlternateBuffer } from '../../hooks/terminal/use-alternate-buffer.js';
import { SCROLL_TO_ITEM_END } from '../shared/virtualized-list.js';
import { ScrollableList } from '../shared/scrollable-list.js';
import { useMemo, memo, useCallback } from 'react';
import { MAX_AGENT_MESSAGE_LINES } from '../indicators/constants.js';
import type { HistoryItem, HistoryItemWithoutId } from '../../types.js';

const MemoizedHistoryItemDisplay = memo(HistoryItemDisplay);
const MemoizedAppHeader = memo(AppHeader);

type SpacingHistoryItem = HistoryItem | HistoryItemWithoutId;

const isCompactToolItem = (item: SpacingHistoryItem): boolean =>
  item.type === 'tool_group' &&
  item.tools.length > 0 &&
  item.tools.every((tool) => tool.presentation?.kind === 'compact');

const shouldSeparateFromPrevious = (
  item: SpacingHistoryItem,
  previous: SpacingHistoryItem | undefined,
): boolean => {
  if (previous === undefined) return false;
  if (item.type === 'dsh_user') return true;
  const itemIsCompact = isCompactToolItem(item);
  const previousIsCompact = isCompactToolItem(previous);
  return (
    itemIsCompact !== previousIsCompact && (itemIsCompact || previousIsCompact)
  );
};

// Limit Agent messages to a very high number of lines to mitigate performance
// issues in the worst case if we somehow get an enormous response from Agent.
// This threshold is arbitrary but should be high enough to never impact normal
// usage.
export const MainContent = () => {
  const { version } = useAppContext();
  const uiState = useUIState();
  const isAlternateBuffer = useAlternateBuffer();

  const {
    pendingHistoryItems,
    mainAreaWidth,
    staticAreaMaxItemHeight,
    availableTerminalHeight,
  } = uiState;
  const pendingHistoryStart =
    uiState.pendingHistoryStart ?? uiState.history.length;
  const staticHistory = useMemo(
    () => uiState.history.slice(0, pendingHistoryStart),
    [uiState.history, pendingHistoryStart],
  );
  const liveItems = useMemo(
    () => [
      ...(isAlternateBuffer
        ? []
        : uiState.history.slice(pendingHistoryStart)
      ).map((item) => ({
        item,
        id: item.id,
        key: `history-${String(item.id)}`,
      })),
      ...pendingHistoryItems.map((item, index) => ({
        item,
        id: 0,
        key: `pending-${String(index)}`,
      })),
    ],
    [
      isAlternateBuffer,
      uiState.history,
      pendingHistoryStart,
      pendingHistoryItems,
    ],
  );

  const historyItems = useMemo(
    () =>
      staticHistory.map((h, index) => (
        <MemoizedHistoryItemDisplay
          terminalWidth={mainAreaWidth}
          availableTerminalHeight={staticAreaMaxItemHeight}
          availableTerminalHeightAgent={MAX_AGENT_MESSAGE_LINES}
          key={h.id}
          item={h}
          separateFromPrevious={shouldSeparateFromPrevious(
            h,
            staticHistory[index - 1],
          )}
          isPending={false}
          commands={uiState.slashCommands}
        />
      )),
    [
      staticHistory,
      mainAreaWidth,
      staticAreaMaxItemHeight,
      uiState.slashCommands,
    ],
  );

  const pendingItems = useMemo(
    () => (
      <OverflowProvider>
        <Box flexDirection="column">
          {liveItems.map(({ item, id, key }, i) => (
            <HistoryItemDisplay
              key={key}
              availableTerminalHeight={
                uiState.constrainHeight && !isAlternateBuffer
                  ? availableTerminalHeight
                  : undefined
              }
              terminalWidth={mainAreaWidth}
              item={{ ...item, id }}
              separateFromPrevious={shouldSeparateFromPrevious(
                item,
                i > 0
                  ? liveItems[i - 1]?.item
                  : isAlternateBuffer
                    ? uiState.history.at(-1)
                    : staticHistory.at(-1),
              )}
              isPending={true}
              isFocused={!uiState.isEditorDialogOpen}
              activeShellPtyId={uiState.activePtyId}
              embeddedShellFocused={uiState.embeddedShellFocused}
            />
          ))}
          <ShowMoreLines constrainHeight={uiState.constrainHeight} />
        </Box>
      </OverflowProvider>
    ),
    [
      liveItems,
      staticHistory,
      uiState.history,
      uiState.constrainHeight,
      isAlternateBuffer,
      availableTerminalHeight,
      mainAreaWidth,
      uiState.isEditorDialogOpen,
      uiState.activePtyId,
      uiState.embeddedShellFocused,
    ],
  );

  const showStartupActions =
    uiState.history.length === 0 && pendingHistoryItems.length === 0;

  const virtualizedData = useMemo(
    () => [
      { type: 'header' as const },
      ...uiState.history.map((item, index) => ({
        type: 'history' as const,
        item,
        pending: index >= pendingHistoryStart,
        separateFromPrevious: shouldSeparateFromPrevious(
          item,
          uiState.history[index - 1],
        ),
      })),
      { type: 'pending' as const },
    ],
    [uiState.history, pendingHistoryStart],
  );

  const renderItem = useCallback(
    ({ item }: { item: (typeof virtualizedData)[number] }) => {
      if (item.type === 'header') {
        return (
          <MemoizedAppHeader
            key="app-header"
            version={version}
            showStartupActions={showStartupActions}
          />
        );
      } else if (item.type === 'history') {
        return (
          <MemoizedHistoryItemDisplay
            terminalWidth={mainAreaWidth}
            availableTerminalHeight={undefined}
            availableTerminalHeightAgent={MAX_AGENT_MESSAGE_LINES}
            key={item.item.id}
            item={item.item}
            separateFromPrevious={item.separateFromPrevious}
            isPending={item.pending}
            commands={uiState.slashCommands}
          />
        );
      } else {
        return pendingItems;
      }
    },
    [
      version,
      showStartupActions,
      mainAreaWidth,
      uiState.slashCommands,
      pendingItems,
    ],
  );

  if (isAlternateBuffer) {
    return (
      <ScrollableList
        hasFocus={!uiState.isEditorDialogOpen}
        width={uiState.terminalWidth}
        data={virtualizedData}
        renderItem={renderItem}
        estimatedItemHeight={() => 100}
        keyExtractor={(item, _index) => {
          if (item.type === 'header') return 'header';
          if (item.type === 'history') return item.item.id.toString();
          return 'pending';
        }}
        initialScrollIndex={SCROLL_TO_ITEM_END}
        initialScrollOffsetInIndex={SCROLL_TO_ITEM_END}
      />
    );
  }

  return (
    <>
      <Static
        key={uiState.historyRemountKey}
        items={[
          <AppHeader
            key="app-header"
            version={version}
            showStartupActions={showStartupActions}
          />,
          ...historyItems,
        ]}
      >
        {(item) => item}
      </Static>
      {pendingItems}
    </>
  );
};
