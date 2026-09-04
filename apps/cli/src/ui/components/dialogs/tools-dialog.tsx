/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Box, Text } from 'ink';
import type React from 'react';
import type { ToolCatalogRuntime } from '../../tool-catalog-runtime.js';
import { theme } from '../../theme/colors.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { DescriptiveRadioButtonSelect } from '../shared/descriptive-radio-button-select.js';
import { DialogCloseAction } from '../shared/dialog-close-action.js';

export interface ToolsDialogProps {
  runtime: ToolCatalogRuntime;
  onClose: () => void;
}

function summary(description: string): string {
  const line = description.replace(/\s+/g, ' ').trim();
  return line.length > 90 ? `${line.slice(0, 89)}...` : line;
}

export function ToolsDialog({
  runtime,
  onClose,
}: ToolsDialogProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [selectedName, setSelectedName] = useState(snapshot.tools[0]?.name);
  const selected =
    snapshot.tools.find((tool) => tool.name === selectedName) ??
    snapshot.tools[0];

  useEffect(() => {
    if (selected?.name !== selectedName) setSelectedName(selected?.name);
  }, [selected?.name, selectedName]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') onClose();
    },
    { isActive: true },
  );

  const items = useMemo(
    () =>
      snapshot.tools.map((tool) => ({
        key: tool.name,
        value: tool.name,
        title: tool.name,
        description: summary(tool.description),
      })),
    [snapshot.tools],
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
          DSH Tools ({snapshot.tools.length})
        </Text>
        <DialogCloseAction onClose={onClose} />
      </Box>
      {snapshot.tools.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            No tools are visible to the current Agent.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="row" marginTop={1}>
          <Box width="55%" paddingRight={2} flexDirection="column">
            <DescriptiveRadioButtonSelect
              items={items}
              onHighlight={setSelectedName}
              onSelect={setSelectedName}
              showNumbers={false}
              showScrollArrows
              maxItemsToShow={10}
            />
          </Box>
          <Box width="45%" paddingLeft={2} flexDirection="column">
            {selected && (
              <>
                <Text bold color={theme.text.accent}>
                  {selected.name}
                </Text>
                <Box marginTop={1}>
                  <Text wrap="wrap">{selected.description}</Text>
                </Box>
                <Box marginTop={1} flexDirection="column">
                  <Text bold color={theme.text.primary}>
                    Parameters
                  </Text>
                  {selected.parameters.length === 0 ? (
                    <Text color={theme.text.secondary}>None</Text>
                  ) : (
                    selected.parameters.map((parameter) => (
                      <Box key={parameter.name} flexDirection="column">
                        <Text color={theme.text.link}>
                          {parameter.name}{' '}
                          <Text color={theme.text.secondary}>
                            {parameter.type}
                            {parameter.required ? ' required' : ' optional'}
                          </Text>
                        </Text>
                        {parameter.description && (
                          <Text color={theme.text.secondary}>
                            {parameter.description}
                          </Text>
                        )}
                      </Box>
                    ))
                  )}
                </Box>
              </>
            )}
          </Box>
        </Box>
      )}
      {snapshot.tools.length > 0 && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Use Up/Down to inspect the current Agent&apos;s tool catalog.
          </Text>
        </Box>
      )}
    </Box>
  );
}
