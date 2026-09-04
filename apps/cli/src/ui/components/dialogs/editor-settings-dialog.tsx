/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import {
  editorSettingsManager,
  type EditorDisplay,
} from '../../editors/editor-settings-manager.js';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import type { LoadableSettingScope } from '../../../config/settings-types.js';
import { SettingScope } from '../../../config/settings-types.js';
import {
  type EditorType,
  isEditorAvailable,
  EDITOR_DISPLAY_NAMES,
  coreEvents,
} from '@cofy-x/dsh-console-core';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import type { LoadedSettings } from '../../../config/user-settings.js';

interface EditorDialogProps {
  onSelect: (
    editorType: EditorType | undefined,
    scope: LoadableSettingScope,
  ) => void;
  settings: LoadedSettings;
  onExit: () => void;
}

export function EditorSettingsDialog({
  onSelect,
  settings,
  onExit,
}: EditorDialogProps): React.JSX.Element {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onExit();
      }
    },
    { isActive: true },
  );

  const editorItems: EditorDisplay[] =
    editorSettingsManager.getAvailableEditorDisplays();

  const currentPreference = settings.forScope(SettingScope.User).settings
    .general?.preferredEditor;
  let editorIndex = currentPreference
    ? editorItems.findIndex(
        (item: EditorDisplay) => item.type === currentPreference,
      )
    : 0;
  if (editorIndex === -1) {
    coreEvents.emitFeedback(
      'error',
      `Editor is not supported: ${currentPreference}`,
    );
    editorIndex = 0;
  }

  const handleEditorSelect = (editorType: EditorType | 'not_set') => {
    if (editorType === 'not_set') {
      onSelect(undefined, SettingScope.User);
      return;
    }
    onSelect(editorType, SettingScope.User);
  };

  let mergedEditorName = 'None';
  if (
    settings.merged.general.preferredEditor &&
    isEditorAvailable(settings.merged.general.preferredEditor)
  ) {
    mergedEditorName =
      EDITOR_DISPLAY_NAMES[
        settings.merged.general.preferredEditor as EditorType
      ];
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="row"
      padding={1}
      width="100%"
    >
      <Box flexDirection="column" width="45%" paddingRight={2}>
        <Text bold>{'> '}Select Editor</Text>
        <RadioButtonSelect
          items={editorItems.map((item) => ({
            label: item.name,
            value: item.type,
            disabled: item.disabled,
            key: item.type,
          }))}
          initialIndex={editorIndex}
          onSelect={handleEditorSelect}
          isFocused={true}
        />

        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            (Use Enter to select, Esc to close)
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" width="55%" paddingLeft={2}>
        <Text bold color={theme.text.primary}>
          Editor Preference
        </Text>
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text color={theme.text.secondary}>
            Select an installed editor to use for external edits.
          </Text>
          <Text color={theme.text.secondary}>
            Your preferred editor is:{' '}
            <Text
              color={
                mergedEditorName === 'None'
                  ? theme.status.error
                  : theme.text.link
              }
              bold
            >
              {mergedEditorName}
            </Text>
            .
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
