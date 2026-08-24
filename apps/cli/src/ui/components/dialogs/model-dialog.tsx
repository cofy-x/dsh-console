/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import type {
  ModelSelectionRuntime,
  ModelSelectionView,
} from '../../model-selection-runtime.js';
import { modelSelectionLabel } from '../../model-selection-runtime.js';

export interface ModelDialogProps {
  runtime: ModelSelectionRuntime;
  onClose: () => void;
  onSwitched: (selection: ModelSelectionView) => void;
}

function capabilityLabel(model: ModelSelectionView): string {
  return model.inputModalities.includes('image') ? 'Text + Vision' : 'Text';
}

export function ModelDialog({
  runtime,
  onClose,
  onSwitched,
}: ModelDialogProps): React.JSX.Element {
  const [models, setModels] = useState<readonly ModelSelectionView[]>([]);
  const [highlighted, setHighlighted] = useState<ModelSelectionView>(
    runtime.getSnapshot().current,
  );
  const [pending, setPending] = useState<ModelSelectionView>();
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string>();

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
              model.provider === current.provider && model.model === current.model,
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

  const current = runtime.getSnapshot().current;
  const initialIndex = Math.max(
    0,
    models.findIndex(
      (model) => model.provider === current.provider && model.model === current.model,
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
        const activated = await runtime.setModel(selection.provider, selection.model);
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

  const selectModel = useCallback(
    (selection: ModelSelectionView) => {
      if (
        selection.provider === current.provider &&
        selection.model === current.model
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
    [current.model, current.provider, onClose, runtime, switchModel],
  );

  useKeypress(
    (key) => {
      if (key.name !== 'escape' || switching) return;
      if (pending) setPending(undefined);
      else onClose();
    },
    { isActive: true },
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
        <Text bold color={theme.text.primary}>Select DSH Model</Text>
        <Text color={theme.text.secondary}>Esc to close</Text>
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error}</Text>
        </Box>
      )}

      {loading ? (
        <Box marginTop={1}><Text color={theme.text.secondary}>Loading models...</Text></Box>
      ) : models.length === 0 ? (
        <Box marginTop={1}><Text color={theme.status.warning}>No DSH models are available.</Text></Box>
      ) : (
        <Box flexDirection="row" marginTop={1}>
          <Box width="55%" paddingRight={2} flexDirection="column">
            <RadioButtonSelect
              key={items.map((item) => item.key).join('|')}
              items={items}
              initialIndex={initialIndex}
              onHighlight={setHighlighted}
              onSelect={selectModel}
              isFocused={!pending && !switching}
              showScrollArrows
              maxItemsToShow={12}
              renderItem={(item, { titleColor }) => {
                const model = item.value;
                const isCurrent =
                  model.provider === current.provider && model.model === current.model;
                return (
                  <Text color={titleColor} wrap="truncate">
                    {model.name}{' '}
                    <Text color={theme.text.secondary}>{model.provider}</Text>
                    {model.inputModalities.includes('image') && (
                      <Text color={theme.status.success}> Vision</Text>
                    )}
                    {isCurrent && <Text color={theme.text.accent}> Current</Text>}
                  </Text>
                );
              }}
            />
          </Box>

          <Box width="45%" paddingLeft={2} flexDirection="column">
            {pending ? (
              <>
                <Text bold color={theme.status.warning}>Start a new Session?</Text>
                <Box marginTop={1} flexDirection="column">
                  <Text>Changing to {pending.name} creates a new DSH Agent and Session.</Text>
                  <Text color={theme.text.secondary}>The existing transcript remains visible but is not sent to the new model.</Text>
                </Box>
                <Box marginTop={1}>
                  <RadioButtonSelect
                    items={[
                      { key: 'continue', label: 'Start new Session', value: true },
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
                <Text bold color={theme.text.primary}>{highlighted.name}</Text>
                <Box marginTop={1} flexDirection="column">
                  <Text color={theme.text.secondary}>Provider</Text>
                  <Text>{highlighted.provider}</Text>
                  <Text color={theme.text.secondary}>Model ID</Text>
                  <Text wrap="wrap">{highlighted.model}</Text>
                  <Text color={theme.text.secondary}>Input</Text>
                  <Text color={
                    highlighted.inputModalities.includes('image')
                      ? theme.status.success
                      : theme.text.primary
                  }>{capabilityLabel(highlighted)}</Text>
                </Box>
                {switching && (
                  <Box marginTop={1}><Text color={theme.text.accent}>Creating new Agent...</Text></Box>
                )}
              </>
            )}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>Use ↑/↓ to navigate and Enter to select.</Text>
      </Box>
    </Box>
  );
}
