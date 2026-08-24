/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import { render } from '../../../test-utils/render.js';
import { StatusDisplay } from './status-display.js';
import {
  UIStateContext,
  type UIState,
} from '../../contexts/ui-state-context.js';
import type { TextBuffer } from '../../hooks/input/use-text-buffer.js';

type UIStateOverrides = Partial<Omit<UIState, 'buffer'>> & {
  buffer?: Partial<TextBuffer>;
};

const createMockUIState = (overrides: UIStateOverrides = {}): UIState =>
  ({
    ctrlCPressedOnce: false,
    warningMessage: null,
    ctrlDPressedOnce: false,
    showEscapePrompt: false,
    queueErrorMessage: null,
    buffer: { text: '' },
    history: [{ id: 1, type: 'user', text: 'test' }],
    ...overrides,
  }) as UIState;

const renderStatusDisplay = (uiState: UIState = createMockUIState()) =>
  render(
    <UIStateContext.Provider value={uiState}>
      <StatusDisplay />
    </UIStateContext.Provider>,
  );

describe('StatusDisplay', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    delete process.env['DSH_CONSOLE_SYSTEM_MD'];
  });

  it('renders system md indicator if env var is set', () => {
    process.env['DSH_CONSOLE_SYSTEM_MD'] = 'true';
    expect(renderStatusDisplay().lastFrame()).toMatchSnapshot();
  });

  it('prioritizes Ctrl+C prompt over everything else (except system md)', () => {
    const uiState = createMockUIState({
      ctrlCPressedOnce: true,
      warningMessage: 'Warning',
    });
    expect(renderStatusDisplay(uiState).lastFrame()).toMatchSnapshot();
  });

  it('renders warning message', () => {
    const uiState = createMockUIState({ warningMessage: 'This is a warning' });
    expect(renderStatusDisplay(uiState).lastFrame()).toMatchSnapshot();
  });

  it('prioritizes warning over Ctrl+D', () => {
    const uiState = createMockUIState({
      warningMessage: 'Warning',
      ctrlDPressedOnce: true,
    });
    expect(renderStatusDisplay(uiState).lastFrame()).toMatchSnapshot();
  });

  it('renders Ctrl+D prompt', () => {
    const uiState = createMockUIState({ ctrlDPressedOnce: true });
    expect(renderStatusDisplay(uiState).lastFrame()).toMatchSnapshot();
  });

  it('does not render an Escape prompt when buffer is empty', () => {
    const uiState = createMockUIState({
      showEscapePrompt: true,
      buffer: { text: '' },
    });
    expect(renderStatusDisplay(uiState).lastFrame()).toBe('');
  });

  it('renders Escape prompt when buffer is NOT empty', () => {
    const uiState = createMockUIState({
      showEscapePrompt: true,
      buffer: { text: 'some text' },
    });
    expect(renderStatusDisplay(uiState).lastFrame()).toMatchSnapshot();
  });

  it('renders Queue Error Message', () => {
    const uiState = createMockUIState({ queueErrorMessage: 'Queue Error' });
    expect(renderStatusDisplay(uiState).lastFrame()).toMatchSnapshot();
  });
});
