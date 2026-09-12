/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Text } from 'ink';
import type {
  AgentActivityRuntime,
  JobView,
} from '../../agent-activity-runtime.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { theme } from '../../theme/colors.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import {
  ActivityPanel,
  plainPanelLine,
  plainPanelText,
} from './activity-dialog-shared.js';

export function JobsDialog({
  runtime,
  onClose,
}: {
  runtime: AgentActivityRuntime;
  onClose(): void;
}) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState<JobView>();
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setSelectedId(undefined);
    setPending(undefined);
    setError(undefined);
  }, [snapshot.sessionId]);
  const selected = snapshot.jobs.find((job) => job.id === selectedId);
  const close = () => {
    if (pending) setPending(undefined);
    else if (selectedId) setSelectedId(undefined);
    else onClose();
  };
  useKeypress(
    (key) => {
      if (key.name === 'escape') close();
    },
    { isActive: true },
  );
  const stop = () => {
    if (!pending) return;
    try {
      runtime.stopJob(pending.sessionId, pending.id);
      setPending(undefined);
    } catch (cause) {
      setError(String(cause));
      setPending(undefined);
    }
  };
  return (
    <ActivityPanel
      title="Background Jobs"
      onClose={close}
      error={error ?? snapshot.error}
    >
      <Text color={theme.text.secondary} wrap="truncate">
        Session: {snapshot.sessionId ?? 'No active Agent'}
      </Text>
      {pending ? (
        <>
          <Text color={theme.status.warning}>
            Stop {plainPanelLine(pending.label)}? Completed work cannot be
            undone.
          </Text>
          <RadioButtonSelect
            items={[
              { key: 'back', value: 'back', label: 'Keep running' },
              { key: 'stop', value: 'stop', label: 'Request stop' },
            ]}
            onSelect={(value) =>
              value === 'stop' ? stop() : setPending(undefined)
            }
            showNumbers={false}
          />
        </>
      ) : selected ? (
        <>
          <Text bold>{plainPanelLine(selected.label)}</Text>
          <Text>
            {selected.kind} / {selected.status} /{' '}
            {Math.max(
              0,
              Math.floor(
                ((selected.finishedAt ?? now) - selected.startedAt) / 1000,
              ),
            )}
            s
          </Text>
          {selected.detail && <Text>{plainPanelText(selected.detail)}</Text>}
          <Text color={theme.text.secondary}>
            Output remains with the Agent and is read through DSH job_output.
          </Text>
          <RadioButtonSelect
            items={[
              { key: 'back', value: 'back', label: 'Back to jobs' },
              ...(selected.status === 'running'
                ? [{ key: 'stop', value: 'stop', label: 'Stop job...' }]
                : []),
            ]}
            onSelect={(value) =>
              value === 'stop' ? setPending(selected) : setSelectedId(undefined)
            }
            showNumbers={false}
          />
        </>
      ) : snapshot.jobs.length === 0 ? (
        <Text>No jobs in the currently interactive Session.</Text>
      ) : (
        <RadioButtonSelect
          items={[...snapshot.jobs].reverse().map((job) => ({
            key: job.id,
            value: job.id,
            label: `${job.status} | ${plainPanelLine(job.id)} | ${plainPanelLine(job.label)}`,
          }))}
          maxItemsToShow={8}
          onSelect={setSelectedId}
          showNumbers={false}
        />
      )}
      <Text color={theme.text.secondary}>
        Live, Session-scoped tasks. Main and Side jobs remain separate.
      </Text>
    </ActivityPanel>
  );
}
