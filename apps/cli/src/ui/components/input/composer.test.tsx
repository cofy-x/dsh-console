/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '../../../test-utils/render.js';
import { Text } from 'ink';
import { Composer } from './composer.js';
import {
  UIStateContext,
  type UIState,
} from '../../contexts/ui-state-context.js';
import {
  UIActionsContext,
  type UIActions,
} from '../../contexts/ui-actions-context.js';
import { ConfigContext } from '../../contexts/config-context.js';
import { SettingsContext } from '../../contexts/settings-context.js';
// Mock VimModeContext hook
vi.mock('../../contexts/vim-mode-context.js', () => ({
  useVimMode: vi.fn(() => ({
    vimEnabled: false,
    vimMode: 'NORMAL',
  })),
}));
import { StreamingState } from '../../types.js';
import { mergeSettings } from '../../../config/user-settings.js';

// Mock child components
vi.mock('../indicators/loading-indicator.js', () => ({
  LoadingIndicator: () => <Text>LoadingIndicator</Text>,
}));

vi.mock('../indicators/shell-mode-indicator.js', () => ({
  ShellModeIndicator: () => <Text>ShellModeIndicator</Text>,
}));

vi.mock('../indicators/detailed-messages-display.js', () => ({
  DetailedMessagesDisplay: () => <Text>DetailedMessagesDisplay</Text>,
}));

vi.mock('./input-prompt.js', () => ({
  InputPrompt: () => <Text>InputPrompt</Text>,
  calculatePromptWidths: vi.fn(() => ({
    inputWidth: 80,
    suggestionsWidth: 40,
    containerWidth: 84,
  })),
}));

vi.mock('../layout/footer.js', () => ({
  Footer: () => <Text>Footer</Text>,
}));

vi.mock('../shared/show-more-lines.js', () => ({
  ShowMoreLines: () => <Text>ShowMoreLines</Text>,
}));

vi.mock('../indicators/queued-message-display.js', () => ({
  QueuedMessageDisplay: ({ messageQueue }: { messageQueue: string[] }) => {
    if (messageQueue.length === 0) {
      return null;
    }
    return (
      <>
        {messageQueue.map((message, index) => (
          <Text key={index}>{message}</Text>
        ))}
      </>
    );
  },
}));

// Mock contexts
vi.mock('../../contexts/overflow-context.js', () => ({
  OverflowProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Create mock context providers
const createMockUIState = (overrides: Partial<UIState> = {}): UIState =>
  ({
    streamingState: null,
    messageQueue: [],
    showErrorDetails: false,
    constrainHeight: false,
    isInputActive: true,
    buffer: { text: '' },
    inputWidth: 80,
    suggestionsWidth: 40,
    userMessages: [],
    slashCommands: [],
    commandContext: null,
    shellModeActive: false,
    isFocused: true,
    currentLoadingPhrase: '',
    elapsedTime: 0,
    ctrlCPressedOnce: false,
    ctrlDPressedOnce: false,
    showEscapePrompt: false,
    renderMarkdown: true,
    filteredConsoleMessages: [],
    history: [],
    sessionStats: {
      lastPromptTokenCount: 0,
      sessionTokenCount: 0,
      totalPrompts: 0,
    },
    branchName: 'main',
    debugMessage: '',
    errorCount: 0,
    nightly: false,
    ...overrides,
  }) as UIState;

const createMockUIActions = (): UIActions =>
  ({
    handleFinalSubmit: vi.fn(),
    handleClearScreen: vi.fn(),
    setShellModeActive: vi.fn(),
    onEscapePromptChange: vi.fn(),
    vimHandleInput: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const createMockConfig = (overrides = {}) => ({
  getModel: vi.fn(() => 'deepseek/deepseek-chat'),
  getTargetDir: vi.fn(() => '/test/dir'),
  getDebugMode: vi.fn(() => false),
  getAccessibility: vi.fn(() => ({})),
  ...overrides,
});

const createMockSettings = (merged = {}) => {
  const defaultMergedSettings = mergeSettings({}, {}, {}, {}, true);
  return {
    merged: {
      ...defaultMergedSettings,
      ui: {
        ...defaultMergedSettings.ui,
        hideFooter: false,
        showMemoryUsage: false,
        ...merged,
      },
    },
  };
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const renderComposer = (
  uiState: UIState,
  settings = createMockSettings(),
  config = createMockConfig(),
  uiActions = createMockUIActions(),
) =>
  render(
    <ConfigContext.Provider value={config as any}>
      <SettingsContext.Provider value={settings as any}>
        <UIStateContext.Provider value={uiState}>
          <UIActionsContext.Provider value={uiActions}>
            <Composer />
          </UIActionsContext.Provider>
        </UIStateContext.Provider>
      </SettingsContext.Provider>
    </ConfigContext.Provider>,
  );
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('Composer', () => {
  describe('Footer Display Settings', () => {
    it('renders Footer by default when hideFooter is false', () => {
      const uiState = createMockUIState();
      const settings = createMockSettings({ hideFooter: false });

      const { lastFrame } = renderComposer(uiState, settings);

      expect(lastFrame()).toContain('Footer');
    });

    it('does NOT render Footer when hideFooter is true', () => {
      const uiState = createMockUIState();
      const settings = createMockSettings({ hideFooter: true });

      const { lastFrame } = renderComposer(uiState, settings);

      // Check for content that only appears IN the Footer component itself
      expect(lastFrame()).not.toContain('[NORMAL]'); // Vim mode indicator
      expect(lastFrame()).not.toContain('(main'); // Branch name with parentheses
    });

    it('passes correct props to Footer including vim mode when enabled', async () => {
      const uiState = createMockUIState({
        branchName: 'feature-branch',
        errorCount: 2,
        sessionStats: {
          sessionId: 'test-session',
          sessionStartTime: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metrics: {} as any,
          lastPromptTokenCount: 150,
          promptCount: 5,
        },
      });
      const config = createMockConfig({
        getModel: vi.fn(() => 'deepseek/deepseek-reasoner'),
        getTargetDir: vi.fn(() => '/project/path'),
        getDebugMode: vi.fn(() => true),
      });
      const settings = createMockSettings({
        hideFooter: false,
        showMemoryUsage: true,
      });
      // Mock vim mode for this test
      const { useVimMode } = await import('../../contexts/vim-mode-context.js');
      vi.mocked(useVimMode).mockReturnValueOnce({
        vimEnabled: true,
        vimMode: 'INSERT',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const { lastFrame } = renderComposer(uiState, settings, config);

      expect(lastFrame()).toContain('Footer');
      // Footer should be rendered with all the state passed through
    });
  });

  describe('Loading Indicator', () => {
    it('renders LoadingIndicator when streaming', () => {
      const uiState = createMockUIState({
        streamingState: StreamingState.Responding,
        currentLoadingPhrase: 'Analyzing',
        elapsedTime: 1500,
      });

      const { lastFrame } = renderComposer(uiState);

      const output = lastFrame();
      expect(output).toContain('LoadingIndicator');
    });

    it('renders LoadingIndicator when accessibility disables loading phrases', () => {
      const uiState = createMockUIState({
        streamingState: StreamingState.Responding,
      });
      const config = createMockConfig({
        getAccessibility: vi.fn(() => ({ enableLoadingPhrases: false })),
      });

      const { lastFrame } = renderComposer(uiState, undefined, config);

      const output = lastFrame();
      expect(output).toContain('LoadingIndicator');
    });

  });

  describe('Message Queue Display', () => {
    it('displays queued messages when present', () => {
      const uiState = createMockUIState({
        messageQueue: [
          'First queued message',
          'Second queued message',
          'Third queued message',
        ],
      });

      const { lastFrame } = renderComposer(uiState);

      const output = lastFrame();
      expect(output).toContain('First queued message');
      expect(output).toContain('Second queued message');
      expect(output).toContain('Third queued message');
    });

    it('renders QueuedMessageDisplay with empty message queue', () => {
      const uiState = createMockUIState({
        messageQueue: [],
      });

      const { lastFrame } = renderComposer(uiState);

      // The component should render but return null for empty queue
      // This test verifies that the component receives the correct prop
      const output = lastFrame();
      expect(output).toContain('InputPrompt'); // Verify basic Composer rendering
    });
  });

  describe('Context and Status Display', () => {
    it('shows Ctrl+C exit prompt when ctrlCPressedOnce is true', () => {
      const uiState = createMockUIState({
        ctrlCPressedOnce: true,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).toContain('Press Ctrl+C again to exit');
    });

    it('shows Ctrl+D exit prompt when ctrlDPressedOnce is true', () => {
      const uiState = createMockUIState({
        ctrlDPressedOnce: true,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).toContain('Press Ctrl+D again to exit');
    });

    it('shows escape prompt when showEscapePrompt is true', () => {
      const uiState = createMockUIState({
        showEscapePrompt: true,
        buffer: { text: 'draft' } as UIState['buffer'],
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).toContain('Press Esc again to clear prompt');
    });
  });

  describe('Input and Indicators', () => {
    it('renders InputPrompt when input is active', () => {
      const uiState = createMockUIState({
        isInputActive: true,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).toContain('InputPrompt');
    });

    it('does not render InputPrompt when input is inactive', () => {
      const uiState = createMockUIState({
        isInputActive: false,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).not.toContain('InputPrompt');
    });

    it('shows ShellModeIndicator when shell mode is active', () => {
      const uiState = createMockUIState({
        shellModeActive: true,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).toContain('ShellModeIndicator');
    });

    it('shows RawMarkdownIndicator when renderMarkdown is false', () => {
      const uiState = createMockUIState({
        renderMarkdown: false,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).toContain('raw markdown mode');
    });

    it('does not show RawMarkdownIndicator when renderMarkdown is true', () => {
      const uiState = createMockUIState({
        renderMarkdown: true,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).not.toContain('raw markdown mode');
    });
  });

  describe('Error Details Display', () => {
    it('shows DetailedMessagesDisplay when showErrorDetails is true', () => {
      const uiState = createMockUIState({
        showErrorDetails: true,
        filteredConsoleMessages: [
          { level: 'error', message: 'Test error', timestamp: new Date() },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).toContain('DetailedMessagesDisplay');
      expect(lastFrame()).toContain('ShowMoreLines');
    });

    it('does not show error details when showErrorDetails is false', () => {
      const uiState = createMockUIState({
        showErrorDetails: false,
      });

      const { lastFrame } = renderComposer(uiState);

      expect(lastFrame()).not.toContain('DetailedMessagesDisplay');
    });
  });
});
