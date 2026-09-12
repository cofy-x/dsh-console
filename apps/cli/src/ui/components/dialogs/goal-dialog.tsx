/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Text } from 'ink';
import type {
  AgentActivityRuntime,
  GoalAction,
  GoalExpectation,
} from '../../agent-activity-runtime.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { theme } from '../../theme/colors.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import {
  ActivityPanel,
  PanelInput,
  PanelPreview,
  plainPanelText,
} from './activity-dialog-shared.js';

type Editor = {
  kind: 'create' | 'objective' | 'rounds';
  expected: GoalExpectation;
};

export function GoalDialog({
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
  const [editor, setEditor] = useState<Editor | undefined>(() =>
    snapshot.goal === undefined
      ? {
          kind: 'create',
          expected: { sessionId: snapshot.sessionId, goal: undefined },
        }
      : undefined,
  );
  const [pending, setPending] = useState<{
    action: GoalAction;
    expected: GoalExpectation;
  }>();
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const goal = snapshot.goal;
  const expected = (): GoalExpectation => ({
    sessionId: snapshot.sessionId,
    goal: goal && { id: goal.id, revision: goal.revision },
  });
  const back = () => {
    setEditor(undefined);
    setPending(undefined);
    setError(undefined);
  };
  const cancelEditor = () => {
    if (goal === undefined && editor?.kind === 'create') onClose();
    else back();
  };
  const close = () => {
    if (!snapshot.busy) {
      if (editor || pending) back();
      else onClose();
    }
  };
  useKeypress(
    (key) => {
      if (key.name === 'escape') close();
    },
    { isActive: editor === undefined },
  );
  const submit = async () => {
    if (pending === undefined) return;
    controller.current = new AbortController();
    setError(undefined);
    try {
      await runtime.changeGoal(
        pending.expected,
        pending.action,
        controller.current.signal,
      );
      if (mounted.current) back();
    } catch (cause) {
      if (mounted.current) {
        setPending(undefined);
        setEditor(undefined);
        setError(String(cause));
      }
    }
  };
  const choose = (value: string) => {
    setError(undefined);
    if (value === 'create' || value === 'objective' || value === 'rounds') {
      setEditor({ kind: value, expected: expected() });
    } else if (
      value === 'pause' ||
      value === 'resume' ||
      value === 'complete' ||
      value === 'clear'
    ) {
      setPending({ expected: expected(), action: { kind: value } });
    }
  };
  const edit = (value: string) => {
    if (!editor) return;
    if (editor.kind === 'rounds') {
      const cap = Number(value);
      if (!Number.isSafeInteger(cap) || cap <= 0) {
        setError('Round limit must be a positive integer.');
        return;
      }
      setPending({
        expected: editor.expected,
        action: { kind: 'edit', maxGoalRounds: cap },
      });
      setEditor(undefined);
    } else {
      if (!value.trim()) {
        setError('The objective cannot be empty.');
        return;
      }
      if (editor.kind === 'create') {
        setPending({
          expected: editor.expected,
          action: { kind: 'create', objective: value.trim() },
        });
        setEditor(undefined);
      } else {
        setPending({
          expected: editor.expected,
          action: { kind: 'edit', objective: value.trim() },
        });
        setEditor(undefined);
      }
    }
  };
  const options = [
    ...(!goal || goal.phase === 'complete'
      ? [{ key: 'create', value: 'create', label: 'Create goal...' }]
      : []),
    ...(goal && goal.phase !== 'complete'
      ? [
          { key: 'objective', value: 'objective', label: 'Edit objective...' },
          { key: 'rounds', value: 'rounds', label: 'Change round limit...' },
          ...(goal.phase === 'active' && goal.activation === 'armed'
            ? [{ key: 'pause', value: 'pause', label: 'Pause goal...' }]
            : [
                {
                  key: 'resume',
                  value: 'resume',
                  label: 'Resume and arm goal...',
                },
              ]),
          { key: 'complete', value: 'complete', label: 'Mark complete...' },
        ]
      : []),
    ...(goal ? [{ key: 'clear', value: 'clear', label: 'Clear goal...' }] : []),
  ];
  return (
    <ActivityPanel
      title="Goal"
      onClose={close}
      busy={snapshot.busy}
      error={error ?? snapshot.error}
    >
      {!pending &&
        (goal ? (
          <>
            <Text bold>
              {goal.phase === 'complete'
                ? `Completed · ${goal.roundsStarted} round${goal.roundsStarted === 1 ? '' : 's'}`
                : goal.phase === 'blocked'
                  ? `Blocked · Round ${goal.roundsStarted}`
                  : goal.phase === 'paused'
                    ? `Paused · Round ${goal.roundsStarted}`
                    : goal.activation === 'disarmed'
                      ? `Ready to resume · Round ${goal.roundsStarted}`
                      : goal.roundsStarted === 0
                        ? 'Ready'
                        : `Active · Round ${goal.roundsStarted}`}
            </Text>
            {goal.phase === 'active' && goal.activation === 'disarmed' && (
              <Text color={theme.status.warning}>
                Resume when you are ready to continue this Goal.
              </Text>
            )}
            {goal.blockedReason && (
              <Text color={theme.status.warning}>
                {plainPanelText(goal.blockedReason)}
              </Text>
            )}
            <PanelPreview text={goal.objective} active={!editor && !pending} />
          </>
        ) : (
          !editor && (
            <>
              <Text bold>No active goal</Text>
              <Text color={theme.text.secondary}>
                Set an objective to keep the agent working across rounds.
              </Text>
            </>
          )
        ))}
      {editor ? (
        <PanelInput
          key={editor.kind}
          initial={
            editor.kind === 'objective'
              ? goal?.objective
              : editor.kind === 'rounds'
                ? String(goal?.maxGoalRounds ?? '')
                : ''
          }
          label={editor.kind === 'rounds' ? 'Round limit' : 'Goal objective'}
          onSubmit={edit}
          onCancel={cancelEditor}
        />
      ) : pending ? (
        <Box flexDirection="column">
          <Text bold>
            {pending.action.kind === 'create' ||
            pending.action.kind === 'resume'
              ? pending.action.kind === 'create'
                ? 'Start goal?'
                : 'Resume goal?'
              : pending.action.kind === 'pause'
                ? 'Pause goal?'
                : pending.action.kind === 'clear'
                  ? 'Clear goal?'
                  : pending.action.kind === 'complete'
                    ? 'Complete goal?'
                    : 'Update goal?'}
          </Text>
          {(pending.action.kind === 'create' ||
            pending.action.kind === 'edit') &&
            pending.action.objective && (
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor={theme.border.default}
                paddingX={1}
                marginTop={1}
              >
                <Text color={theme.text.secondary}>Objective</Text>
                <Text>{plainPanelText(pending.action.objective)}</Text>
              </Box>
            )}
          {pending.action.kind === 'pause' && (
            <Text color={theme.text.secondary}>
              The current goal Turn may be cancelled.
            </Text>
          )}
          {pending.action.kind === 'clear' && (
            <Text color={theme.text.secondary}>
              Prior events remain in Session history.
            </Text>
          )}
          <Box marginTop={1}>
            <RadioButtonSelect
              items={[
                { key: 'back', value: 'back', label: 'Go back' },
                { key: 'confirm', value: 'confirm', label: 'Confirm' },
              ]}
              onSelect={(value) =>
                value === 'confirm' ? void submit() : back()
              }
              isFocused={!snapshot.busy}
              showNumbers={false}
            />
          </Box>
        </Box>
      ) : (
        <RadioButtonSelect
          items={options}
          onSelect={choose}
          isFocused={!snapshot.busy}
          showNumbers={false}
        />
      )}
    </ActivityPanel>
  );
}
