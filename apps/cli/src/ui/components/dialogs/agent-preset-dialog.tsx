/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Box, Text } from 'ink';
import type {
  AgentPresetOptionView,
  AgentPresetRuntime,
} from '../../agent-preset-runtime.js';
import { theme } from '../../theme/colors.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import { DialogCloseAction } from '../shared/dialog-close-action.js';

export interface AgentPresetDialogProps {
  runtime: AgentPresetRuntime;
  onClose: () => void;
  onSwitched: (selection: AgentPresetOptionView) => void;
}

export function AgentPresetDialog({
  runtime,
  onClose,
  onSwitched,
}: AgentPresetDialogProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [highlighted, setHighlighted] = useState<AgentPresetOptionView>();
  const [error, setError] = useState<string>();
  const selected =
    highlighted ??
    snapshot.options.find((item) => item.id === snapshot.currentId) ??
    snapshot.options[0];
  const items = useMemo(
    () =>
      snapshot.options.map((option) => ({
        key: option.id,
        value: option,
        label: option.name,
      })),
    [snapshot.options],
  );
  const initialIndex = Math.max(
    0,
    snapshot.options.findIndex((option) => option.id === snapshot.currentId),
  );

  const selectPreset = useCallback(
    async (option: AgentPresetOptionView) => {
      setError(undefined);
      if (option.broken !== undefined) {
        setError(`This preset is unavailable: ${option.broken}`);
        return;
      }
      if (option.id === snapshot.currentId) {
        onClose();
        return;
      }
      try {
        onSwitched(await runtime.select(option.id));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [onClose, onSwitched, runtime, snapshot.currentId],
  );

  useKeypress(
    (key) => {
      if (key.name === 'escape' && !snapshot.busy) onClose();
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
        <Text bold color={theme.text.primary}>
          Select DSH Agent Preset
        </Text>
        <DialogCloseAction onClose={onClose} isActive={!snapshot.busy} />
      </Box>
      {(error ?? snapshot.error) && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{error ?? snapshot.error}</Text>
        </Box>
      )}
      {snapshot.options.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            No Agent presets are available.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="row" marginTop={1}>
          <Box width="50%" paddingRight={2} flexDirection="column">
            <RadioButtonSelect
              key={items.map((item) => item.key).join('|')}
              items={items}
              initialIndex={initialIndex}
              onHighlight={setHighlighted}
              onSelect={(option) => void selectPreset(option)}
              isFocused={!snapshot.busy}
              showNumbers={false}
              renderItem={(item, { titleColor }) => (
                <Text
                  color={
                    item.value.broken === undefined
                      ? titleColor
                      : theme.text.secondary
                  }
                  wrap="truncate"
                >
                  {item.value.name}
                  {item.value.id === snapshot.currentId && (
                    <Text color={theme.text.accent}> Current</Text>
                  )}
                  {item.value.isDefault && (
                    <Text color={theme.text.secondary}> Default</Text>
                  )}
                </Text>
              )}
            />
          </Box>
          <Box width="50%" paddingLeft={2} flexDirection="column">
            {selected && (
              <>
                <Text bold color={theme.text.accent}>
                  {selected.name}
                </Text>
                <Text color={theme.text.secondary}>
                  {selected.id} · {selected.trust}
                </Text>
                <Box marginTop={1}>
                  <Text wrap="wrap">
                    {selected.description ??
                      'No description is available for this preset.'}
                  </Text>
                </Box>
                {selected.broken && (
                  <Box marginTop={1}>
                    <Text color={theme.status.warning}>{selected.broken}</Text>
                  </Box>
                )}
                {snapshot.busy && (
                  <Box marginTop={1}>
                    <Text color={theme.text.accent}>Applying preset...</Text>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          A preset can change only before the current Session starts.
        </Text>
      </Box>
    </Box>
  );
}
