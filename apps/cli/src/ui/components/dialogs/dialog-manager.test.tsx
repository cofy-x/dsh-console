/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../../test-utils/render.js';
import { DialogManager } from './dialog-manager.js';
import { describe, it, expect, vi } from 'vitest';
import { Text } from 'ink';
import { type UIState } from '../../contexts/ui-state-context.js';

// Mock child components
vi.mock('./consent-prompt.js', () => ({
  ConsentPrompt: () => <Text>ConsentPrompt</Text>,
}));
vi.mock('./theme-dialog.js', () => ({
  ThemeDialog: () => <Text>ThemeDialog</Text>,
}));
vi.mock('./settings-dialog.js', () => ({
  SettingsDialog: () => <Text>SettingsDialog</Text>,
}));

vi.mock('./editor-settings-dialog.js', () => ({
  EditorSettingsDialog: () => <Text>EditorSettingsDialog</Text>,
}));

describe('DialogManager', () => {
  const defaultProps = {
    terminalWidth: 100,
  };

  const baseUiState = {
    constrainHeight: false,
    terminalHeight: 24,
    staticExtraHeight: 0,
    terminalWidth: 80,
    confirmationRequest: null,
    isThemeDialogOpen: false,
    isSettingsDialogOpen: false,
    isEditorDialogOpen: false,
    selectedAgentName: undefined,
    selectedAgentDisplayName: undefined,
    selectedAgentDefinition: undefined,
  };

  it('renders nothing by default', () => {
    const { lastFrame } = renderWithProviders(
      <DialogManager {...defaultProps} />,

      { uiState: baseUiState },
    );
    expect(lastFrame()).toBe('');
  });

  const testCases: Array<[Partial<UIState>, string]> = [
    [
      { confirmationRequest: { prompt: 'foo', onConfirm: vi.fn() } },
      'ConsentPrompt',
    ],
    [{ isThemeDialogOpen: true }, 'ThemeDialog'],
    [{ isSettingsDialogOpen: true }, 'SettingsDialog'],
    [{ isEditorDialogOpen: true }, 'EditorSettingsDialog'],
  ];

  it.each(testCases)(
    'renders %s when state is %o',
    (uiStateOverride, expectedComponent) => {
      const { lastFrame } = renderWithProviders(
        <DialogManager {...defaultProps} />,
        {

          uiState: { ...baseUiState, ...uiStateOverride },
        },
      );
      expect(lastFrame()).toContain(expectedComponent);
    },
  );
});
