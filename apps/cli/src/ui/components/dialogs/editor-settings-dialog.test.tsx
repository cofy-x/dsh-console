/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { EditorSettingsDialog } from './editor-settings-dialog.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingScope } from '../../../config/settings-types.js';
import type { LoadedSettings } from '../../../config/user-settings.js';
import { KeypressProvider } from '../../contexts/keypress-context.js';
import { act } from 'react';
import { waitFor } from '../../../test-utils/async.js';

vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
  return {
    ...actual,
    isEditorAvailable: () => true, // Mock to behave predictably in CI
  };
});

// Mock editorSettingsManager
vi.mock('../../editors/editor-settings-manager.js', () => ({
  editorSettingsManager: {
    getAvailableEditorDisplays: () => [
      { name: 'VS Code', type: 'vscode', disabled: false },
      { name: 'Vim', type: 'vim', disabled: false },
    ],
  },
}));

describe('EditorSettingsDialog', () => {
  const mockSettings = {
    forScope: (scope: string) => ({
      settings: {
        general: {
          preferredEditor: scope === SettingScope.User ? 'vscode' : undefined,
        },
      },
    }),
    merged: {
      general: {
        preferredEditor: 'vscode',
      },
    },
  } as unknown as LoadedSettings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProvider = (ui: React.ReactNode) =>
    render(<KeypressProvider>{ui}</KeypressProvider>);

  it('renders correctly', () => {
    const { lastFrame } = renderWithProvider(
      <EditorSettingsDialog
        onSelect={vi.fn()}
        settings={mockSettings}
        onExit={vi.fn()}
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('stores editor selections in user settings', async () => {
    const onSelect = vi.fn();
    const { lastFrame, stdin } = renderWithProvider(
      <EditorSettingsDialog
        onSelect={onSelect}
        settings={mockSettings}
        onExit={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('VS Code');
    await act(async () => {
      stdin.write('\r');
    });
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('vscode', SettingScope.User);
    });
    expect(lastFrame()).not.toContain('Apply To');
  });

  it('calls onExit when Escape is pressed', async () => {
    const onExit = vi.fn();
    const { stdin } = renderWithProvider(
      <EditorSettingsDialog
        onSelect={vi.fn()}
        settings={mockSettings}
        onExit={onExit}
      />,
    );

    await act(async () => {
      stdin.write('\u001B'); // Escape
    });

    await waitFor(() => {
      expect(onExit).toHaveBeenCalled();
    });
  });
});
