/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { AgentRespondingSpinner } from './agent-responding-spinner.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStreamingContext } from '../../contexts/streaming-context.js';
import { useIsScreenReaderEnabled } from 'ink';
import { StreamingState } from '../../types.js';
import {
  SCREEN_READER_LOADING,
  SCREEN_READER_RESPONDING,
} from '../../accessibility.js';

vi.mock('../../contexts/streaming-context.js');
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useIsScreenReaderEnabled: vi.fn(),
  };
});

vi.mock('./cli-spinner.js', () => ({
  CliSpinner: () => 'Spinner',
}));

describe('AgentRespondingSpinner', () => {
  const mockUseStreamingContext = vi.mocked(useStreamingContext);
  const mockUseIsScreenReaderEnabled = vi.mocked(useIsScreenReaderEnabled);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsScreenReaderEnabled.mockReturnValue(false);
  });

  it('renders spinner when responding', () => {
    mockUseStreamingContext.mockReturnValue(StreamingState.Responding);
    const { lastFrame } = render(<AgentRespondingSpinner />);
    // Spinner output varies, but it shouldn't be empty
    expect(lastFrame()).not.toBe('');
  });

  it('renders screen reader text when responding and screen reader enabled', () => {
    mockUseStreamingContext.mockReturnValue(StreamingState.Responding);
    mockUseIsScreenReaderEnabled.mockReturnValue(true);
    const { lastFrame } = render(<AgentRespondingSpinner />);
    expect(lastFrame()).toContain(SCREEN_READER_RESPONDING);
  });

  it('renders nothing when not responding and no non-responding display', () => {
    mockUseStreamingContext.mockReturnValue(StreamingState.Idle);
    const { lastFrame } = render(<AgentRespondingSpinner />);
    expect(lastFrame()).toBe('');
  });

  it('renders non-responding display when provided', () => {
    mockUseStreamingContext.mockReturnValue(StreamingState.Idle);
    const { lastFrame } = render(
      <AgentRespondingSpinner nonRespondingDisplay="Waiting..." />,
    );
    expect(lastFrame()).toContain('Waiting...');
  });

  it('renders screen reader loading text when non-responding display provided and screen reader enabled', () => {
    mockUseStreamingContext.mockReturnValue(StreamingState.Idle);
    mockUseIsScreenReaderEnabled.mockReturnValue(true);
    const { lastFrame } = render(
      <AgentRespondingSpinner nonRespondingDisplay="Waiting..." />,
    );
    expect(lastFrame()).toContain(SCREEN_READER_LOADING);
  });
});
