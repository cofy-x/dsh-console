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
  ModelSelectionRuntime,
  ModelSelectionView,
} from '../../model-selection-runtime.js';
import {
  modelReasoningEffortLabel,
  modelSelectionLabel,
} from '../../model-selection-runtime.js';
import type { ProviderSetupRuntime } from '../../provider-setup-runtime.js';
import { formatTokenCount } from '../../utils/format-token-count.js';
import { ProviderSetupDialog } from './provider-setup-dialog.js';
import { DialogCloseAction } from '../shared/dialog-close-action.js';

export interface ModelDialogProps {
  runtime: ModelSelectionRuntime;
  onClose: () => void;
  onSwitched: (selection: ModelSelectionView) => void;
  providerSetupRuntime?: ProviderSetupRuntime;
}

function capabilityLabel(model: ModelSelectionView): string {
  return model.inputModalities.includes('image') ? 'Text + Vision' : 'Text';
}

export function ModelDialog({
  runtime,
  onClose,
  onSwitched,
  providerSetupRuntime,
}: ModelDialogProps): React.JSX.Element {
  const [models, setModels] = useState<readonly ModelSelectionView[]>([]);
  const [highlighted, setHighlighted] = useState<ModelSelectionView>(
    runtime.getSnapshot().current,
  );
  const [pending, setPending] = useState<ModelSelectionView>();
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState(false);
  const [error, setError] = useState<string>();
  const [setupSelection, setSetupSelection] = useState<ModelSelectionView>();
  const [reasoningSelection, setReasoningSelection] =
    useState<ModelSelectionView>();
  const providerCheckRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    void runtime
      .listModels(controller.signal)
      .then((listed) => {
        const sorted = [...listed].sort(
          (left, right) =>
            left.provider.localeCompare(right.provider) ||
            left.name.localeCompare(right.name),
        );
        setModels(sorted);
        const current = runtime.getSnapshot().current;
        setHighlighted(
          sorted.find(
            (model) =>
              model.provider === current.provider &&
              model.model === current.model,
          ) ?? current,
        );
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [runtime]);

  useEffect(() => () => providerCheckRef.current?.abort(), []);

  const current = runtime.getSnapshot().current;
  const initialIndex = Math.max(
    0,
    models.findIndex(
      (model) =>
        model.provider === current.provider && model.model === current.model,
    ),
  );
  const items = useMemo(
    () =>
      models.map((model) => ({
        key: modelSelectionLabel(model),
        value: model,
        label: model.name,
      })),
    [models],
  );

  const switchModel = useCallback(
    async (selection: ModelSelectionView) => {
      setSwitching(true);
      setError(undefined);
      try {
        const activated = await runtime.setModel({
          provider: selection.provider,
          model: selection.model,
          ...(selection.reasoning?.selectedEffort === undefined
            ? {}
            : { reasoningEffort: selection.reasoning.selectedEffort }),
        });
        onSwitched(activated);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setPending(undefined);
      } finally {
        setSwitching(false);
      }
    },
    [onSwitched, runtime],
  );

  const finishSelection = useCallback(
    (selection: ModelSelectionView) => {
      if (
        selection.provider === current.provider &&
        selection.model === current.model &&
        selection.reasoning?.selectedEffort ===
          current.reasoning?.selectedEffort
      ) {
        onClose();
        return;
      }
      if (runtime.hasConversation()) {
        setPending(selection);
        return;
      }
      void switchModel(selection);
    },
    [
      current.model,
      current.provider,
      current.reasoning?.selectedEffort,
      onClose,
      runtime,
      switchModel,
    ],
  );

  const continueSelection = useCallback(
    (selection: ModelSelectionView) => {
      if (selection.reasoning?.efforts.length) {
        setReasoningSelection(selection);
        return;
      }
      finishSelection(selection);
    },
    [finishSelection],
  );

  const selectModel = useCallback(
    async (selection: ModelSelectionView) => {
      if (providerSetupRuntime) {
        providerCheckRef.current?.abort();
        const controller = new AbortController();
        providerCheckRef.current = controller;
        setCheckingProvider(true);
        setError(undefined);
        try {
          const setup = await providerSetupRuntime.describeProvider(
            selection.provider,
            controller.signal,
          );
          if (setup.status === 'missing') {
            if (!setup.writable) {
              setError(
                `${setup.credentialLabel ?? 'The credential'} is supplied by a read-only source and is not configured.`,
              );
              return;
            }
            setSetupSelection(selection);
            return;
          }
        } catch (cause) {
          if (
            controller.signal.aborted ||
            (cause instanceof Error && cause.name === 'AbortError')
          ) {
            return;
          }
          setError(cause instanceof Error ? cause.message : String(cause));
          return;
        } finally {
          if (providerCheckRef.current === controller) {
            providerCheckRef.current = undefined;
            setCheckingProvider(false);
          }
        }
      }
      continueSelection(selection);
    },
    [continueSelection, providerSetupRuntime],
  );

  const dismiss = useCallback(() => {
    if (switching) return;
    if (checkingProvider) {
      providerCheckRef.current?.abort();
      return;
    }
    if (pending) setPending(undefined);
    else if (reasoningSelection) setReasoningSelection(undefined);
    else onClose();
  }, [checkingProvider, onClose, pending, reasoningSelection, switching]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') dismiss();
    },
    { isActive: setupSelection === undefined },
  );

  if (setupSelection) {
    return (
      <ProviderSetupDialog
        runtime={providerSetupRuntime!}
        provider={setupSelection.provider}
        onCancel={() => setSetupSelection(undefined)}
        onConfigured={() => {
          const selection = setupSelection;
          setSetupSelection(undefined);
          continueSelection(selection);
        }}
      />
    );
  }

  if (reasoningSelection?.reasoning) {
    const reasoning = reasoningSelection.reasoning;
    const defaultName = reasoning.efforts.find(
      (effort) => effort.id === reasoning.defaultEffort,
    )?.name;
    const selectedEffort =
      reasoningSelection.provider === current.provider &&
      reasoningSelection.model === current.model
        ? current.reasoning?.selectedEffort
        : undefined;
    const effortItems = [
      {
        key: 'provider-default',
        value: undefined,
        label: `Provider default${defaultName ? ` (${defaultName})` : ''}`,
      },
      ...reasoning.efforts.map((effort) => ({
        key: effort.id,
        value: effort.id,
        label: effort.name,
      })),
    ];
    const initialEffortIndex = Math.max(
      0,
      effortItems.findIndex((item) => item.value === selectedEffort),
    );
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
            Select Reasoning Effort
          </Text>
          <DialogCloseAction onClose={dismiss} label="Esc to models" />
        </Box>
        <Box marginTop={1} flexDirection="row">
          <Box width="55%" paddingRight={2} flexDirection="column">
            <RadioButtonSelect
              items={effortItems}
              initialIndex={initialEffortIndex}
              onSelect={(reasoningEffort) => {
                setReasoningSelection(undefined);
                finishSelection({
                  ...reasoningSelection,
                  reasoning: {
                    ...reasoning,
                    ...(reasoningEffort === undefined
                      ? { selectedEffort: undefined }
                      : { selectedEffort: reasoningEffort }),
                  },
                });
              }}
              isFocused={!switching}
              showNumbers={false}
            />
          </Box>
          <Box width="45%" paddingLeft={2} flexDirection="column">
            <Text bold color={theme.text.primary}>
              {reasoningSelection.name}
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text color={theme.text.secondary}>Current choice</Text>
              <Text>
                {modelReasoningEffortLabel({
                  ...reasoningSelection,
                  reasoning: { ...reasoning, selectedEffort },
                })}
              </Text>
              <Text color={theme.text.secondary}>Behavior</Text>
              <Text wrap="wrap">
                Provider default follows the model adapter. An explicit effort
                remains fixed for this Agent and future Sessions.
              </Text>
            </Box>
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Use ↑/↓ to navigate and Enter to select.
          </Text>
        </Box>
      </Box>
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
          Select DSH Model
        </Text>
        <DialogCloseAction
          onClose={dismiss}
          isActive={!switching}
          label={
            checkingProvider
              ? 'Esc to cancel'
              : pending
                ? 'Esc to models'
                : undefined
          }
        />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}

      {loading ? (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>Loading models...</Text>
        </Box>
      ) : models.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.status.warning}>No DSH models are available.</Text>
        </Box>
      ) : (
        <Box flexDirection="row" marginTop={1}>
          <Box width="55%" paddingRight={2} flexDirection="column">
            <RadioButtonSelect
              key={items.map((item) => item.key).join('|')}
              items={items}
              initialIndex={initialIndex}
              onHighlight={setHighlighted}
              onSelect={(selection) => void selectModel(selection)}
              isFocused={!pending && !switching && !checkingProvider}
              showScrollArrows
              maxItemsToShow={12}
              renderItem={(item, { titleColor }) => {
                const model = item.value;
                const isCurrent =
                  model.provider === current.provider &&
                  model.model === current.model;
                return (
                  <Text color={titleColor} wrap="truncate">
                    {model.name}{' '}
                    <Text color={theme.text.secondary}>{model.provider}</Text>
                    {model.inputModalities.includes('image') && (
                      <Text color={theme.status.success}> Vision</Text>
                    )}
                    {isCurrent && (
                      <Text color={theme.text.accent}> Current</Text>
                    )}
                  </Text>
                );
              }}
            />
          </Box>

          <Box width="45%" paddingLeft={2} flexDirection="column">
            {pending ? (
              <>
                <Text bold color={theme.status.warning}>
                  Start a new Session?
                </Text>
                <Box marginTop={1} flexDirection="column">
                  <Text>
                    Changing to {pending.name} creates a new DSH Agent and
                    Session.
                  </Text>
                  <Text color={theme.text.secondary}>
                    The existing transcript remains visible but is not sent to
                    the new model.
                  </Text>
                </Box>
                <Box marginTop={1}>
                  <RadioButtonSelect
                    items={[
                      {
                        key: 'continue',
                        label: 'Start new Session',
                        value: true,
                      },
                      { key: 'back', label: 'Back to models', value: false },
                    ]}
                    onSelect={(confirmed) => {
                      if (confirmed) void switchModel(pending);
                      else setPending(undefined);
                    }}
                    isFocused={!switching}
                    showNumbers={false}
                  />
                </Box>
              </>
            ) : (
              <>
                <Text bold color={theme.text.primary}>
                  {highlighted.name}
                </Text>
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.text.secondary}>Provider</Text>
                  <Text>{highlighted.provider}</Text>
                  <Text color={theme.text.secondary}>Model ID</Text>
                  <Text wrap="wrap">{highlighted.model}</Text>
                  <Text color={theme.text.secondary}>Input</Text>
                  <Text
                    color={
                      highlighted.inputModalities.includes('image')
                        ? theme.status.success
                        : theme.text.primary
                    }
                  >
                    {capabilityLabel(highlighted)}
                  </Text>
                  <Text color={theme.text.secondary}>Context window</Text>
                  <Text>
                    {highlighted.contextWindow === undefined
                      ? 'Not disclosed'
                      : `${formatTokenCount(highlighted.contextWindow)} tokens`}
                  </Text>
                </Box>
                {switching && (
                  <Box marginTop={1}>
                    <Text color={theme.text.accent}>Creating new Agent...</Text>
                  </Box>
                )}
                {checkingProvider && (
                  <Box marginTop={1}>
                    <Text color={theme.text.accent}>
                      Checking provider setup...
                    </Text>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Use ↑/↓ to navigate and Enter to select.
        </Text>
      </Box>
    </Box>
  );
}
