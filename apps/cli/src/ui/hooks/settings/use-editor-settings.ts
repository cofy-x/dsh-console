/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import type { LoadableSettingScope } from '../../../config/settings-types.js';
import type { UseHistoryManagerReturn } from '../session/use-history-manager.js';
import {
  checkHasEditorType,
  getEditorDisplayName,
  type EditorType,
} from '@cofy-x/dsh-console-core';
import type { LoadedSettings } from '../../../config/user-settings.js';
import { MessageType } from '../../types.js';
import { SettingPaths } from '../../../config/setting-paths.js';

interface UseEditorSettingsReturn {
  isEditorDialogOpen: boolean;
  openEditorDialog: () => void;
  handleEditorSelect: (
    editorType: EditorType | undefined,
    scope: LoadableSettingScope,
  ) => void;
  exitEditorDialog: () => void;
}

export const useEditorSettings = (
  loadedSettings: LoadedSettings,
  setEditorError: (error: string | null) => void,
  addItem: UseHistoryManagerReturn['addItem'],
): UseEditorSettingsReturn => {
  const [isEditorDialogOpen, setIsEditorDialogOpen] = useState(false);

  const openEditorDialog = useCallback(() => {
    setIsEditorDialogOpen(true);
  }, []);

  const handleEditorSelect = useCallback(
    (editorType: EditorType | undefined, scope: LoadableSettingScope) => {
      if (editorType && !checkHasEditorType(editorType)) {
        return;
      }

      try {
        loadedSettings.setValue(
          scope,
          SettingPaths.General.PreferredEditor,
          editorType,
        );
        addItem(
          {
            type: MessageType.INFO,
            text: `Editor preference ${editorType ? `set to "${getEditorDisplayName(editorType)}"` : 'cleared'} in ${scope} settings.`,
          },
          Date.now(),
        );
        setEditorError(null);
        setIsEditorDialogOpen(false);
      } catch (error) {
        setEditorError(`Failed to set editor preference: ${error}`);
      }
    },
    [loadedSettings, setEditorError, addItem],
  );

  const exitEditorDialog = useCallback(() => {
    setIsEditorDialogOpen(false);
  }, []);

  return {
    isEditorDialogOpen,
    openEditorDialog,
    handleEditorSelect,
    exitEditorDialog,
  };
};
