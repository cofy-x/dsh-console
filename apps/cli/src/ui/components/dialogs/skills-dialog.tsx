/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Box, Text } from 'ink';
import type { SkillCatalogRuntime } from '../../skill-catalog-runtime.js';
import { theme } from '../../theme/colors.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { DescriptiveRadioButtonSelect } from '../shared/descriptive-radio-button-select.js';
import { DialogCloseAction } from '../shared/dialog-close-action.js';

export interface SkillsDialogProps {
  runtime: SkillCatalogRuntime;
  onClose: () => void;
}

function summary(value: string): string {
  const line = value.replace(/\s+/g, ' ').trim();
  return line.length > 90 ? `${line.slice(0, 89)}...` : line;
}

export function SkillsDialog({
  runtime,
  onClose,
}: SkillsDialogProps): React.JSX.Element {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [selectedName, setSelectedName] = useState(snapshot.skills[0]?.name);
  const selected =
    snapshot.skills.find((skill) => skill.name === selectedName) ??
    snapshot.skills[0];
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
      snapshot.skills.map((skill) => ({
        key: skill.name,
        value: skill.name,
        title: `/${skill.name}`,
        description: summary(skill.description),
      })),
    [snapshot.skills],
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
          DSH Skills ({snapshot.skills.length})
        </Text>
        <DialogCloseAction onClose={onClose} />
      </Box>
      {snapshot.error && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{snapshot.error}</Text>
        </Box>
      )}
      {snapshot.skills.length === 0 ? (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            No user-invocable Skills are visible to the current Agent.
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
                  /{selected.name}
                </Text>
                {!selected.modelInvocable && (
                  <Text color={theme.status.warning}>User invocation only</Text>
                )}
                <Box marginTop={1}>
                  <Text wrap="wrap">{selected.description}</Text>
                </Box>
                {selected.whenToUse && (
                  <Box marginTop={1} flexDirection="column">
                    <Text bold color={theme.text.primary}>
                      When to use
                    </Text>
                    <Text wrap="wrap">{selected.whenToUse}</Text>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      )}
      {snapshot.skills.length > 0 && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            Type /name to invoke a Skill through DSH.
          </Text>
        </Box>
      )}
    </Box>
  );
}
