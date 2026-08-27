/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import type {
  SessionListItemView,
  SessionManagementRuntime,
} from '../../session-management-runtime.js';

export interface SessionDialogProps {
  runtime: SessionManagementRuntime;
  onClose: () => void;
}

function shortId(id: string): string {
  const start = id.startsWith('dsh-console-') ? 'dsh-console-'.length : 0;
  return id.slice(start, start + 12);
}

function sessionLabel(session: SessionListItemView): string {
  return session.title ?? `Session ${shortId(session.id)}`;
}

export function SessionDialog({ runtime, onClose }: SessionDialogProps): React.JSX.Element {
  const [sessions, setSessions] = useState<readonly SessionListItemView[]>([]);
  const [highlighted, setHighlighted] = useState<SessionListItemView>();
  const [pending, setPending] = useState<SessionListItemView>();
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string>();
  const switchingRef = useRef(false);
  const titleRequestsRef = useRef(new Map<string, AbortController>());

  const resolveTitles = useCallback((candidates: readonly SessionListItemView[]) => {
    const sessionsToResolve = candidates.filter((session) =>
      !session.title && !titleRequestsRef.current.has(session.id));
    if (sessionsToResolve.length === 0) return;
    const controller = new AbortController();
    for (const session of sessionsToResolve) {
      titleRequestsRef.current.set(session.id, controller);
    }
    void runtime.resolveSessionTitles(
      sessionsToResolve.map((session) => session.id),
      controller.signal,
    ).then((titles) => {
      if (controller.signal.aborted || titles.length === 0) return;
      const titleById = new Map(titles.map(({ id, title }) => [id, title]));
      const withResolvedTitle = (item: SessionListItemView): SessionListItemView => {
        const title = titleById.get(item.id);
        return title === undefined ? item : { ...item, title };
      };
      setSessions((current) => current.map(withResolvedTitle));
      setHighlighted((current) => current ? withResolvedTitle(current) : current);
      setPending((current) => current ? withResolvedTitle(current) : current);
    }).catch(() => {
      // Title failures are non-fatal; the stable Session ID fallback remains usable.
    }).finally(() => {
      for (const session of sessionsToResolve) {
        if (titleRequestsRef.current.get(session.id) === controller) {
          titleRequestsRef.current.delete(session.id);
        }
      }
    });
  }, [runtime]);

  useEffect(() => {
    const controller = new AbortController();
    void runtime.listSessions(controller.signal).then((listed) => {
      setSessions(listed);
      setHighlighted(listed.find((session) => session.current) ?? listed[0]);
      resolveTitles(listed.slice(0, 12));
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => {
      controller.abort();
      for (const titleController of titleRequestsRef.current.values()) titleController.abort();
      titleRequestsRef.current.clear();
    };
  }, [resolveTitles, runtime]);

  const items = useMemo(() => sessions.map((session) => ({
    key: session.id,
    value: session,
    label: sessionLabel(session),
  })), [sessions]);
  const initialIndex = Math.max(0, sessions.findIndex((session) => session.current));
  const highlight = useCallback((session: SessionListItemView) => {
    setHighlighted(session);
    resolveTitles([session]);
  }, [resolveTitles]);

  const resume = useCallback(async (session: SessionListItemView) => {
    if (switchingRef.current) return;
    switchingRef.current = true;
    setSwitching(true);
    setError(undefined);
    try {
      await runtime.resumeSession(session.id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPending(undefined);
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  }, [onClose, runtime]);

  const select = useCallback((session: SessionListItemView) => {
    if (session.current) {
      onClose();
      return;
    }
    if (!session.resumable) {
      setError(session.resumeUnavailableReason ?? 'This Session cannot be resumed.');
      return;
    }
    if (runtime.hasConversation()) setPending(session);
    else void resume(session);
  }, [onClose, resume, runtime]);

  useKeypress((key) => {
    if (key.name !== 'escape' || switching) return;
    if (pending) setPending(undefined);
    else onClose();
  }, { isActive: true });

  return (
    <Box borderStyle="round" borderColor={theme.border.default} flexDirection="column" paddingX={1} paddingY={1} width="100%">
      <Box justifyContent="space-between">
        <Text bold color={theme.text.primary}>DSH Sessions</Text>
        <Text color={theme.text.secondary}>Esc to close</Text>
      </Box>
      {error && <Box marginTop={1}><Text color={theme.status.error}>{error}</Text></Box>}
      {loading ? (
        <Box marginTop={1}><Text color={theme.text.secondary}>Loading Sessions...</Text></Box>
      ) : sessions.length === 0 ? (
        <Box marginTop={1}><Text color={theme.text.secondary}>No resumable Sessions.</Text></Box>
      ) : (
        <Box flexDirection="row" marginTop={1}>
          <Box width="55%" paddingRight={2} flexDirection="column">
            <RadioButtonSelect
              items={items}
              initialIndex={initialIndex}
              onHighlight={highlight}
              onSelect={select}
              isFocused={!pending && !switching}
              showScrollArrows
              maxItemsToShow={12}
              renderItem={(item, { titleColor }) => (
                <Text color={titleColor} wrap="truncate">
                  {sessionLabel(item.value)}
                  {item.value.current && <Text color={theme.text.accent}> Current</Text>}
                  {!item.value.current && !item.value.resumable && (
                    <Text color={theme.status.warning}> Not resumable</Text>
                  )}
                </Text>
              )}
            />
          </Box>
          <Box width="45%" paddingLeft={2} flexDirection="column">
            {pending ? (
              <>
                <Text bold color={theme.status.warning}>Resume this Session?</Text>
                <Box marginTop={1} flexDirection="column">
                  <Text>{sessionLabel(pending)}</Text>
                  <Text color={theme.text.secondary}>The current transcript will be replaced.</Text>
                </Box>
                <Box marginTop={1}>
                  <RadioButtonSelect
                    items={[
                      { key: 'resume', label: 'Resume Session', value: true },
                      { key: 'back', label: 'Back to Sessions', value: false },
                    ]}
                    onSelect={(confirmed) => confirmed ? void resume(pending) : setPending(undefined)}
                    isFocused={!switching}
                    showNumbers={false}
                  />
                </Box>
              </>
            ) : highlighted ? (
              <>
                <Text bold>{sessionLabel(highlighted)}</Text>
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.text.secondary}>Created</Text>
                  <Text>{new Date(highlighted.createdAt).toLocaleString()}</Text>
                  {!highlighted.resumable && highlighted.resumeUnavailableReason && (
                    <>
                      <Text color={theme.text.secondary}>Resume status</Text>
                      <Text color={theme.status.warning}>{highlighted.resumeUnavailableReason}</Text>
                    </>
                  )}
                  <Text color={theme.text.secondary}>Session ID</Text>
                  <Text wrap="wrap">{highlighted.id}</Text>
                </Box>
              </>
            ) : null}
          </Box>
        </Box>
      )}
      <Box marginTop={1}><Text color={theme.text.secondary}>Use ↑/↓ to navigate and Enter to resume.</Text></Box>
    </Box>
  );
}
