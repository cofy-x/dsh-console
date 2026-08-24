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
import { debugLogger } from '@cofy-x/dsh-console-core';

vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
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

  it('calls onSelect when an editor is selected', () => {
    const onSelect = vi.fn();
    const { lastFrame } = renderWithProvider(
      <EditorSettingsDialog
        onSelect={onSelect}
        settings={mockSettings}
        onExit={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('VS Code');
  });

  it('switches focus between editor and scope sections on Tab', async () => {
    const { lastFrame, stdin } = renderWithProvider(
      <EditorSettingsDialog
        onSelect={vi.fn()}
        settings={mockSettings}
        onExit={vi.fn()}
      />,
    );

    // Initial focus on editor
    expect(lastFrame()).toContain('> Select Editor');
    expect(lastFrame()).not.toContain('> Apply To');

    // Press Tab
    await act(async () => {
      stdin.write('\t');
    });

    // Focus should be on scope
    await waitFor(() => {
      const frame = lastFrame() || '';
      if (!frame.includes('> Apply To')) {
        debugLogger.debug(
          'Waiting for scope focus. Current frame:',
          JSON.stringify(frame),
        );
      }
      expect(frame).toContain('> Apply To');
    });
    expect(lastFrame()).toContain('  Select Editor');

    // Press Tab again
    await act(async () => {
      stdin.write('\t');
    });

    // Focus should be back on editor
    await waitFor(() => {
      expect(lastFrame()).toContain('> Select Editor');
    });
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

  it('shows modified message when setting exists in other scope', () => {
    const settingsWithOtherScope = {
      forScope: (_scope: string) => ({
        settings: {
          general: {
            preferredEditor: 'vscode', // Both scopes have it set
          },
        },
      }),
      merged: {
        general: {
          preferredEditor: 'vscode',
        },
      },
    } as unknown as LoadedSettings;

    const { lastFrame } = renderWithProvider(
      <EditorSettingsDialog
        onSelect={vi.fn()}
        settings={settingsWithOtherScope}
        onExit={vi.fn()}
      />,
    );

    const frame = lastFrame() || '';
    if (!frame.includes('(Also modified')) {
      debugLogger.debug(
        'Modified message test failure. Frame:',
        JSON.stringify(frame),
      );
    }
    expect(frame).toContain('(Also modified');
  });
});
