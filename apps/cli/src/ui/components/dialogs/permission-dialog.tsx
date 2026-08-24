/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Box, Text } from 'ink';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import type {
  PermissionOptionView,
  PermissionSelectionRuntime,
} from '../../permission-selection-runtime.js';
import { theme } from '../../theme/colors.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';

export interface PermissionDialogProps {
  runtime: PermissionSelectionRuntime;
  onClose: () => void;
  onSwitched: (selection: PermissionOptionView) => void;
}
export function PermissionDialog({
  runtime,
  onClose,
  onSwitched,
}: PermissionDialogProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [highlighted, setHighlighted] = useState<PermissionOptionView>();
  const [pending, setPending] = useState<PermissionOptionView>();
  const [error, setError] = useState<string>();
  const selected =
    highlighted ??
    snapshot.options.find((option) => option.value === snapshot.currentValue) ??
    snapshot.options[0];
  const items = useMemo(
    () =>
      snapshot.options.map((option) => ({
        key: option.value,
        value: option,
        label: option.name,
      })),
    [snapshot.options],
  );
  const initialIndex = Math.max(
    0,
    snapshot.options.findIndex((option) => option.value === snapshot.currentValue),
  );

  const switchPermission = useCallback(
    async (option: PermissionOptionView) => {
      setError(undefined);
      try {
        const activated = await runtime.setPermission(option.value);
        onSwitched(activated);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setPending(undefined);
      }
    },
    [onSwitched, runtime],
  );

  const selectPermission = useCallback(
    (option: PermissionOptionView) => {
      if (option.value === snapshot.currentValue) {
        onClose();
        return;
      }
      if (option.requiresConfirmation) {
        setPending(option);
        return;
      }
      void switchPermission(option);
    },
    [onClose, snapshot.currentValue, switchPermission],
  );

  useKeypress(
    (key) => {
      if (key.name !== 'escape' || snapshot.busy) return;
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
        <Text bold color={theme.text.primary}>Select DSH Permission</Text>
        <Text color={theme.text.secondary}>Esc to close</Text>
      </Box>

      {error && (
        <Box marginTop={1}><Text color={theme.status.error}>{error}</Text></Box>
      )}

      {!snapshot.available ? (
        <Box marginTop={1}>
          <Text color={theme.status.warning}>DSH permission presets are unavailable.</Text>
        </Box>
      ) : snapshot.options.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.status.warning}>No permission presets are available.</Text>
        </Box>
      ) : (
        <Box flexDirection="row" marginTop={1}>
          <Box width="50%" paddingRight={2} flexDirection="column">
            <RadioButtonSelect
              key={items.map((item) => item.key).join('|')}
              items={items}
              initialIndex={initialIndex}
              onHighlight={setHighlighted}
              onSelect={selectPermission}
              isFocused={!pending && !snapshot.busy}
              showNumbers={false}
              renderItem={(item, { titleColor }) => (
                <Text color={titleColor} wrap="truncate">
                  {item.value.name}
                  {item.value.value === snapshot.currentValue && (
                    <Text color={theme.text.accent}> Current</Text>
                  )}
                </Text>
              )}
            />
          </Box>

          <Box width="50%" paddingLeft={2} flexDirection="column">
            {pending ? (
              <>
                <Text bold color={theme.status.warning}>Enable Full access?</Text>
                <Box marginTop={1}>
                  <Text>This allows commands to run without workspace sandbox restrictions or approval prompts.</Text>
                </Box>
                <Box marginTop={1}>
                  <RadioButtonSelect
                    items={[
                      { key: 'enable', label: 'Enable Full access', value: true },
                      { key: 'back', label: 'Back', value: false },
                    ]}
                    onSelect={(confirmed) => {
                      if (confirmed) void switchPermission(pending);
                      else setPending(undefined);
                    }}
                    isFocused={!snapshot.busy}
                    showNumbers={false}
                  />
                </Box>
              </>
            ) : selected ? (
              <>
                <Text bold color={theme.text.primary}>{selected.name}</Text>
                <Text color={theme.text.secondary}>{selected.value}</Text>
                <Box marginTop={1}>
                  <Text>{selected.description ?? 'No description is available for this preset.'}</Text>
                </Box>
                {snapshot.busy && (
                  <Box marginTop={1}><Text color={theme.text.accent}>Applying permission...</Text></Box>
                )}
              </>
            ) : null}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>Changes apply to the current DSH Session immediately. No restart required.</Text>
      </Box>
    </Box>
  );
}
