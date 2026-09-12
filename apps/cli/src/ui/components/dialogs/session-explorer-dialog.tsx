/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import type {
  SessionExplorerRuntime,
  SessionPreview,
  SessionSearchItem,
} from '../../session-explorer-runtime.js';
import type { SessionManagementRuntime } from '../../session-management-runtime.js';
import type { ConversationContentBlock } from '../../conversation-runtime.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { useTextBuffer } from '../../hooks/input/use-text-buffer.js';
import { theme } from '../../theme/colors.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import { TextInput } from '../shared/text-input.js';
import {
  ActivityPanel,
  PanelInput,
  PanelPreview,
  plainPanelLine,
} from './activity-dialog-shared.js';

const SESSION_PAGE_SIZE = 8;

function stableSessionItems(
  current: readonly SessionSearchItem[],
  incoming: readonly SessionSearchItem[],
): readonly SessionSearchItem[] {
  const next = new Map(incoming.map((item) => [item.id, item]));
  const stable = current.flatMap((item) => {
    const updated = next.get(item.id);
    if (updated === undefined) return [];
    next.delete(item.id);
    return [updated];
  });
  return [...stable, ...next.values()];
}

function contentText(content: readonly ConversationContentBlock[]): string {
  return content
    .map((block) =>
      'text' in block && typeof block.text === 'string'
        ? block.text
        : `[${block.type}]`,
    )
    .join('\n');
}

export function sessionPreviewText(preview: SessionPreview): string {
  return preview.messages
    .map((message) =>
      message.role === 'tool'
        ? `[tool: ${message.name}] ${message.arguments}\n${contentText(message.result?.content ?? [])}`
        : `[${message.role}]\n${contentText(message.content)}`,
    )
    .join('\n\n');
}

export function SessionExplorerDialog({
  runtime,
  explorer,
  onClose,
}: {
  runtime: SessionManagementRuntime;
  explorer: SessionExplorerRuntime;
  onClose(): void;
}) {
  const { terminalWidth } = useUIState();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly SessionSearchItem[]>([]);
  const [preview, setPreview] = useState<SessionPreview>();
  const [mode, setMode] = useState<'list' | 'details' | 'rename' | 'fork'>(
    'list',
  );
  const [pending, setPending] = useState<{
    id: string;
    kind: 'resume' | 'fork';
    boundary?: number;
  }>();
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const actionController = useRef<AbortController | undefined>(undefined);
  const searchController = useRef<AbortController | undefined>(undefined);
  const refresh = useRef<(value: string) => void>(() => {});
  const queryRef = useRef(query);
  const resultQuery = useRef<string | undefined>(undefined);
  const modeRef = useRef(mode);
  const mounted = useRef(true);
  const writing = useRef(false);
  const searchBuffer = useTextBuffer({
    initialText: '',
    initialCursorOffset: 0,
    viewport: { width: Math.max(12, terminalWidth - 10), height: 1 },
    isValidPath: () => false,
    singleLine: true,
    onChange: setQuery,
  });
  const run = async (
    action: (signal: AbortSignal) => Promise<void>,
    write = false,
  ) => {
    if (writing.current) return;
    actionController.current?.abort();
    writing.current = write;
    const current = new AbortController();
    actionController.current = current;
    setBusy(true);
    setError(undefined);
    try {
      await action(current.signal);
    } catch (cause) {
      if (mounted.current && !current.signal.aborted) setError(String(cause));
    } finally {
      if (actionController.current === current) {
        writing.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };
  const search = (value: string) => {
    if (writing.current) return;
    searchController.current?.abort();
    const current = new AbortController();
    searchController.current = current;
    setSearching(true);
    setError(undefined);
    void explorer
      .search(value, current.signal)
      .then((found) => {
        current.signal.throwIfAborted();
        if (!mounted.current) return;
        if (
          value === '' &&
          resultQuery.current !== value &&
          found.loading &&
          found.items.length < SESSION_PAGE_SIZE
        ) {
          setLoading(true);
          setNotice(found.notice);
          return;
        }
        setItems((visible) =>
          resultQuery.current === value
            ? stableSessionItems(visible, found.items)
            : found.items,
        );
        resultQuery.current = value;
        setLoading(found.loading ?? false);
        setNotice(found.notice);
        setMode('list');
        setPreview(undefined);
      })
      .catch((cause) => {
        if (mounted.current && !current.signal.aborted) setError(String(cause));
      })
      .finally(() => {
        if (searchController.current === current && mounted.current)
          setSearching(false);
      });
  };
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = explorer.subscribe?.(() => {
      if (modeRef.current === 'list') refresh.current(queryRef.current);
    });
    return () => {
      mounted.current = false;
      actionController.current?.abort();
      searchController.current?.abort();
      unsubscribe?.();
    };
  }, [explorer]);
  refresh.current = search;
  queryRef.current = query;
  modeRef.current = mode;
  useEffect(() => {
    if (mode !== 'list') return;
    const timer = setTimeout(() => search(query), query ? 150 : 0);
    return () => clearTimeout(timer);
    // Search owns the latest cancellable request; result publication is fenced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explorer, mode, query]);
  const open = (id: string) => {
    modeRef.current = 'details';
    setMode('details');
    setPreview(undefined);
    void run(async (signal) => {
      const next = await explorer.preview(id, signal);
      signal.throwIfAborted();
      if (mounted.current) {
        setPreview(next);
        setMode('details');
      }
    });
  };
  const back = () => {
    if (writing.current) return;
    if (!pending && mode === 'list') {
      onClose();
      return;
    }
    setError(undefined);
    if (pending) setPending(undefined);
    else if (mode === 'details') {
      setMode('list');
      setPreview(undefined);
    } else setMode('details');
  };
  const close = () => {
    if (writing.current) return;
    if (busy) {
      actionController.current?.abort();
      onClose();
    } else back();
  };
  useKeypress(
    (key) => {
      if (key.name === 'escape') close();
    },
    { isActive: mode !== 'rename' },
  );
  const confirm = () => {
    if (!pending) return;
    void run(async (signal) => {
      if (pending.kind === 'resume')
        await runtime.resumeSession(pending.id, signal);
      else if (pending.boundary !== undefined)
        await explorer.fork(pending.id, pending.boundary, signal);
      if (mounted.current) onClose();
    }, true);
  };
  const rename = (title: string) => {
    if (!preview) return;
    void run(async (signal) => {
      const accepted = await explorer.rename(preview.id, title, signal);
      if (mounted.current) {
        setPreview({ ...preview, title: accepted });
        setItems((current) =>
          current.map((item) =>
            item.id === preview.id ? { ...item, title: accepted } : item,
          ),
        );
        setMode('details');
      }
    }, true);
  };
  const actions = (value: string) => {
    if (!preview) return;
    if (value === 'resume') setPending({ id: preview.id, kind: 'resume' });
    else if (value === 'rename' || value === 'fork') setMode(value);
    else if (value === 'back') {
      setMode('list');
      setPreview(undefined);
    }
  };
  return (
    <ActivityPanel
      title={mode === 'list' ? 'Workspace Sessions' : 'Session'}
      onClose={close}
      busy={busy && preview !== undefined}
      cancelable={!writing.current}
      error={error}
    >
      {notice && <Text color={theme.status.warning}>{notice}</Text>}
      {pending ? (
        <>
          <Text color={theme.status.warning}>
            {pending.kind === 'fork'
              ? 'Create and switch to a persistent fork at this completed Turn? Files stay unchanged; inherited goals remain disarmed.'
              : 'Resume this Session and replace the current transcript? The current Session stays in history.'}
          </Text>
          <RadioButtonSelect
            items={[
              { key: 'back', value: 'back', label: 'Go back' },
              { key: 'confirm', value: 'confirm', label: 'Confirm' },
            ]}
            onSelect={(value) =>
              value === 'confirm' ? confirm() : setPending(undefined)
            }
            isFocused={!busy}
            showNumbers={false}
          />
        </>
      ) : mode === 'rename' && preview ? (
        <PanelInput
          initial={preview.title ?? ''}
          label="Session title (user titles stay pinned)"
          onSubmit={rename}
          onCancel={back}
        />
      ) : mode === 'fork' && preview ? (
        <>
          <Text>Choose the completed Turn to inherit:</Text>
          {preview.turns.length === 0 ? (
            <Text>No completed Turn is available.</Text>
          ) : (
            <RadioButtonSelect
              items={[...preview.turns].reverse().map((turn) => ({
                key: String(turn.seq),
                value: turn.seq,
                label: `Turn ${turn.turn} / ${new Date(turn.time).toLocaleString()}`,
              }))}
              maxItemsToShow={Math.max(
                3,
                Math.min(8, Math.floor(((process.stdout.rows ?? 24) - 8) / 2)),
              )}
              onSelect={(boundary) =>
                setPending({ id: preview.id, kind: 'fork', boundary })
              }
              isFocused={!busy}
              showNumbers={false}
            />
          )}
        </>
      ) : mode === 'details' && preview ? (
        <>
          <Text bold wrap="truncate">
            {plainPanelLine(preview.title ?? 'Untitled Session')}
          </Text>
          <Text color={theme.text.secondary} wrap="truncate">
            ID · {plainPanelLine(preview.id)}
          </Text>
          {preview.parentSessionId && (
            <Text color={theme.text.secondary} wrap="truncate">
              Forked from · {plainPanelLine(preview.parentSessionId)}
            </Text>
          )}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={theme.border.default}
            paddingX={1}
            marginTop={1}
          >
            <Text color={theme.text.secondary}>Conversation preview</Text>
            <PanelPreview
              key={preview.id}
              text={
                sessionPreviewText(preview) ||
                'This Session has no conversation messages.'
              }
              active={!busy}
              fullWidth
            />
          </Box>
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.text.secondary}>Actions</Text>
            <RadioButtonSelect
              items={[
                ...(preview.messages.length > 0
                  ? [{ key: 'resume', value: 'resume', label: 'Resume...' }]
                  : []),
                { key: 'rename', value: 'rename', label: 'Rename...' },
                ...(preview.turns.length > 0
                  ? [
                      {
                        key: 'fork',
                        value: 'fork',
                        label: 'Fork from turn...',
                      },
                    ]
                  : []),
                { key: 'back', value: 'back', label: 'Back' },
              ]}
              onSelect={actions}
              isFocused={!busy}
              showNumbers={false}
            />
          </Box>
        </>
      ) : mode === 'details' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text.secondary}>
            {busy ? 'Loading Session...' : 'Session details unavailable.'}
          </Text>
          {!busy && (
            <RadioButtonSelect
              items={[{ key: 'back', value: 'back', label: 'Back' }]}
              onSelect={back}
              isFocused
              showNumbers={false}
            />
          )}
        </Box>
      ) : (
        <>
          <Box
            borderStyle="round"
            borderColor={busy ? theme.border.default : theme.border.focused}
            paddingX={1}
            height={3}
            marginTop={1}
          >
            <TextInput
              focus={!busy}
              buffer={searchBuffer}
              placeholder="Search titles, ids, and conversation text"
              onSubmit={() => {}}
              onCancel={() => {}}
            />
          </Box>
          {items.length === 0 ? (
            <Box marginTop={1}>
              <Text>
                {loading || searching
                  ? 'Loading Sessions'
                  : 'No matching Sessions in this directory.'}
              </Text>
            </Box>
          ) : (
            <Box marginTop={1}>
              <RadioButtonSelect
                key={query}
                items={items.map((item) => ({
                  key: item.id,
                  value: item.id,
                  label: plainPanelLine(item.title ?? item.id),
                }))}
                maxItemsToShow={SESSION_PAGE_SIZE}
                onSelect={open}
                isFocused={!busy && !searching}
                showNumbers={false}
                renderItem={(entry, { titleColor }) => {
                  const item = items.find(
                    (candidate) => candidate.id === entry.value,
                  );
                  if (!item) return null;
                  const shortId = item.id
                    .replace(/^dsh-console-(?:fork-)?/u, '')
                    .slice(0, 8);
                  return (
                    <Box flexDirection="column">
                      <Text color={titleColor} wrap="truncate">
                        {item.current ? '* ' : ''}
                        {plainPanelLine(item.title ?? `Session ${shortId}`)}
                        {item.parentSessionId ? '  [fork]' : ''}
                      </Text>
                      <Text color={theme.text.secondary} wrap="truncate">
                        {new Date(item.createdAt).toLocaleString()} {shortId}
                        {item.snippet
                          ? `  |  ${plainPanelLine(item.snippet)}`
                          : ''}
                      </Text>
                    </Box>
                  );
                }}
              />
            </Box>
          )}
          {(items.length > 0 || (!searching && !loading)) && (
            <Text color={theme.text.secondary}>
              {searching
                ? 'Searching Sessions...'
                : loading
                  ? 'Loading more Sessions'
                  : 'Type to search; Up/Down to browse; Enter for details.'}
            </Text>
          )}
        </>
      )}
    </ActivityPanel>
  );
}
