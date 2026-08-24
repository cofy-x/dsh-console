/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext } from 'react';
import { type EditorType } from '@cofy-x/dsh-console-core';
import type { LoadableSettingScope } from '../../config/settings-types.js';
import type { Key } from '../../terminal/keys.js';

export interface UIActions {
  handleThemeSelect: (themeName: string, scope: LoadableSettingScope) => void;
  closeThemeDialog: () => void;
  handleThemeHighlight: (themeName: string | undefined) => void;
  handleEditorSelect: (
    editorType: EditorType | undefined,
    scope: LoadableSettingScope,
  ) => void;
  exitEditorDialog: () => void;
  closeSettingsDialog: () => void;
  setShellModeActive: (value: boolean) => void;
  vimHandleInput: (key: Key) => boolean;
  setConstrainHeight: (value: boolean) => void;
  onEscapePromptChange: (show: boolean) => void;
  refreshStatic: () => void;
  handleFinalSubmit: (value: string) => void;
  handleClearScreen: () => void;
  setQueueErrorMessage: (message: string | null) => void;
  popAllMessages: () => string | undefined;
  setEmbeddedShellFocused: (value: boolean) => void;
  handleRestart: () => void;
}

export const UIActionsContext = createContext<UIActions | null>(null);

export const useUIActions = () => {
  const context = useContext(UIActionsContext);
  if (!context) {
    throw new Error('useUIActions must be used within a UIActionsProvider');
  }
  return context;
};
