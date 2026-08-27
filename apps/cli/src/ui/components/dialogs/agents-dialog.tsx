/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Box, Text } from 'ink';
import type React from 'react';
import type {
  SubagentCatalogItemView,
  SubagentCatalogRuntime,
} from '../../subagent-catalog-runtime.js';
import { theme } from '../../theme/colors.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { DescriptiveRadioButtonSelect } from '../shared/descriptive-radio-button-select.js';
import type { SubagentTranscriptRuntime } from '../../subagent-transcript-runtime.js';
import { HistoryItemDisplay } from '../session/history-item-display.js';
import { ScrollableList, type ScrollableListRef } from '../shared/scrollable-list.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import {
  conversationMessageToHistoryItem,
  projectedToolCallIds,
} from '../../conversation-history-projector.js';

export interface AgentsDialogProps {
  runtime: SubagentCatalogRuntime;
  onClose: () => void;
}

function shortId(id: string): string {
  return id.slice(-8);
}

function itemTitle(item: SubagentCatalogItemView): string {
  const branch = item.depth > 1 ? `${'  '.repeat(item.depth - 1)}- ` : '';
  return `${branch}${item.kind === 'agent' ? item.label : `Unavailable ${shortId(item.id)}`}`;
}

function itemDescription(item: SubagentCatalogItemView): string {
  if (item.kind === 'diagnostic') return `diagnostic · ${item.reason}`;
  return `${item.activity} · ${item.mode}`;
}

export function AgentsDialog({ runtime, onClose }: AgentsDialogProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [selectedId, setSelectedId] = useState(snapshot.items[0]?.id);
  const [transcript, setTranscript] = useState<SubagentTranscriptRuntime>();
  const [transcriptSessionId, setTranscriptSessionId] = useState<string>();
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string>();
  const openController = useRef<AbortController | undefined>(undefined);
  const openingRef = useRef(false);
  const transcriptRef = useRef<SubagentTranscriptRuntime | undefined>(undefined);
  const selected =
    snapshot.items.find((item) => item.id === selectedId) ?? snapshot.items[0];

  useEffect(() => {
    const controller = new AbortController();
    void runtime.refresh(controller.signal);
    return () => controller.abort();
  }, [runtime]);

  useEffect(
    () => () => {
      openController.current?.abort();
      transcriptRef.current?.dispose();
      transcriptRef.current = undefined;
    },
    [],
  );

  useEffect(() => {
    if (selected?.id !== selectedId) setSelectedId(selected?.id);
  }, [selected?.id, selectedId]);

  useKeypress(
    (key) => {
      if (transcript !== undefined) return;
      if (key.name === 'escape') onClose();
      if (key.name === 'r') void runtime.refresh();
    },
    { isActive: true },
  );

  const openTranscript = useCallback(
    async (sessionId: string) => {
      const item = snapshot.items.find(
        (candidate) => candidate.id === sessionId && candidate.kind === 'agent',
      );
      if (item === undefined || openingRef.current) return;
      openingRef.current = true;
      openController.current?.abort();
      const controller = new AbortController();
      openController.current = controller;
      setOpening(true);
      setOpenError(undefined);
      try {
        const next = await runtime.openTranscript(sessionId, controller.signal);
        if (controller.signal.aborted) {
          next.dispose();
          return;
        }
        transcriptRef.current?.dispose();
        transcriptRef.current = next;
        setTranscriptSessionId(sessionId);
        setTranscript(next);
      } catch (error) {
        if (!controller.signal.aborted) {
          setOpenError(
            error instanceof Error
              ? error.message
              : 'Unable to open the subagent transcript.',
          );
        }
      } finally {
        if (openController.current === controller) {
          openController.current = undefined;
          openingRef.current = false;
          if (!controller.signal.aborted) setOpening(false);
        }
      }
    },
    [runtime, snapshot.items],
  );

  const closeTranscript = useCallback(() => {
    openController.current?.abort();
    openController.current = undefined;
    openingRef.current = false;
    transcriptRef.current?.dispose();
    transcriptRef.current = undefined;
    setTranscript(undefined);
    setTranscriptSessionId(undefined);
    setOpenError(undefined);
  }, []);

  const items = useMemo(
    () =>
      snapshot.items.map((item) => ({
        key: item.id,
        value: item.id,
        title: itemTitle(item),
        description: itemDescription(item),
      })),
    [snapshot.items],
  );

  if (transcript !== undefined && transcriptSessionId !== undefined) {
    const item = snapshot.items.find(
      (candidate) => candidate.id === transcriptSessionId,
    );
    return (
      <AgentTranscriptView
        runtime={transcript}
        item={item}
        onBack={closeTranscript}
      />
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      width="100%"
    >
      <Box justifyContent="space-between">
        <Text bold color={theme.text.primary}>
          DSH Agents ({snapshot.items.length})
        </Text>
        <Text color={theme.text.secondary}>R refresh · Esc close</Text>
      </Box>
      {snapshot.status === 'loading' && snapshot.items.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Loading delegated Agents...</Text>
        </Box>
      ) : snapshot.status === 'error' && snapshot.items.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{snapshot.error}</Text>
        </Box>
      ) : snapshot.items.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            The Main Agent has not delegated any subagents in this Session.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="row" marginTop={1}>
          <Box width="55%" paddingRight={2} flexDirection="column">
            <DescriptiveRadioButtonSelect
              items={items}
              onHighlight={setSelectedId}
              onSelect={(sessionId) => void openTranscript(sessionId)}
              showNumbers={false}
              showScrollArrows
              maxItemsToShow={10}
            />
          </Box>
          <Box width="45%" paddingLeft={2} flexDirection="column">
            {selected?.kind === 'agent' ? (
              <>
                <Text bold color={theme.text.accent}>
                  {selected.label}
                </Text>
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.text.secondary}>
                    Status{' '}
                    <Text
                      color={
                        selected.activity === 'running'
                          ? theme.status.success
                          : theme.text.primary
                      }
                    >
                      {selected.activity}
                    </Text>
                  </Text>
                  <Text color={theme.text.secondary}>
                    Mode <Text color={theme.text.primary}>{selected.mode}</Text>
                  </Text>
                  <Text color={theme.text.secondary}>
                    Depth <Text color={theme.text.primary}>{selected.depth}</Text>
                  </Text>
                  <Text color={theme.text.secondary}>
                    Session <Text color={theme.text.primary}>{shortId(selected.id)}</Text>
                  </Text>
                </Box>
              </>
            ) : selected ? (
              <>
                <Text bold color={theme.status.warning}>Unavailable Agent</Text>
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.text.secondary}>
                    Reason <Text color={theme.text.primary}>{selected.reason}</Text>
                  </Text>
                  <Text color={theme.text.secondary}>
                    Session <Text color={theme.text.primary}>{shortId(selected.id)}</Text>
                  </Text>
                </Box>
              </>
            ) : null}
          </Box>
        </Box>
      )}
      {(opening || openError !== undefined) && (
        <Box marginTop={1}>
          <Text color={openError === undefined ? theme.text.secondary : theme.status.error}>
            {openError ?? 'Opening canonical Agent history...'}
          </Text>
        </Box>
      )}
      {snapshot.items.length > 0 && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Enter opens read-only history. Agent conversations remain DSH-owned.
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface AgentTranscriptViewProps {
  runtime: SubagentTranscriptRuntime;
  item: SubagentCatalogItemView | undefined;
  onBack: () => void;
}

function AgentTranscriptView({
  runtime,
  item,
  onBack,
}: AgentTranscriptViewProps): React.JSX.Element {
  const uiState = useUIState();
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const listRef = useRef<ScrollableListRef<ReturnType<typeof transcriptItems>[number]>>(null);
  const history = useMemo(() => transcriptItems(snapshot.messages), [snapshot.messages]);
  const completed = snapshot.todos.filter((todo) => todo.status === 'completed').length;

  useEffect(() => {
    listRef.current?.scrollToEnd();
  }, [history.length]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') onBack();
    },
    { isActive: true },
  );

  const width = Math.max(40, uiState.terminalWidth - 4);
  const height = Math.max(8, uiState.terminalHeight - 6);
  const label = item?.kind === 'agent' ? item.label : shortId(item?.id ?? 'agent');
  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      paddingX={1}
      height={height}
      width="100%"
    >
      <Box justifyContent="space-between">
        <Box>
          <Text bold color={theme.text.primary}>{label}</Text>
          {item?.kind === 'agent' && (
            <Text color={theme.text.secondary}>
              {' '}· {item.mode} ·{' '}
              <Text color={item.activity === 'running' ? theme.status.success : theme.text.secondary}>
                {item.activity}
              </Text>
            </Text>
          )}
        </Box>
        <Text color={theme.text.secondary}>Read only · Esc back</Text>
      </Box>
      {snapshot.todos.length > 0 && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Todo {completed}/{snapshot.todos.length} completed
          </Text>
        </Box>
      )}
      <Box flexGrow={1} marginTop={1} overflow="hidden">
        {history.length === 0 ? (
          <Text color={theme.text.secondary}>
            This Agent has no conversation events yet.
          </Text>
        ) : (
          <ScrollableList
            ref={listRef}
            data={history}
            hasFocus
            width="100%"
            keyExtractor={(entry) => entry.key}
            estimatedItemHeight={() => 3}
            initialScrollIndex={history.length - 1}
            renderItem={({ item: entry, index }) => (
              <HistoryItemDisplay
                item={{ ...entry.item, id: index }}
                terminalWidth={width}
                isPending={snapshot.busy && index === history.length - 1}
                isFocused={false}
              />
            )}
          />
        )}
      </Box>
    </Box>
  );
}

function transcriptItems(
  messages: ReadonlyArray<
    import('../../conversation-runtime.js').ConversationMessage
  >,
) {
  const toolCallIds = projectedToolCallIds(messages);
  return messages.flatMap((message) => {
    const item = conversationMessageToHistoryItem(message, toolCallIds);
    return item === undefined ? [] : [{ key: message.id, item }];
  });
}
