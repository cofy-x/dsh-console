/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { ShowMoreLines } from './show-more-lines.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOverflowState } from '../../contexts/overflow-context.js';
import { useStreamingContext } from '../../contexts/streaming-context.js';
import { StreamingState } from '../../types.js';

vi.mock('../../contexts/overflow-context.js');
vi.mock('../../contexts/streaming-context.js');

describe('ShowMoreLines', () => {
  const mockUseOverflowState = vi.mocked(useOverflowState);
  const mockUseStreamingContext = vi.mocked(useStreamingContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [new Set(), StreamingState.Idle, true], // No overflow
    [new Set(['1']), StreamingState.Idle, false], // Not constraining height
    [new Set(['1']), StreamingState.Responding, true], // Streaming
  ])(
    'renders nothing when: overflow=%s, streaming=%s, constrain=%s',
    (overflowingIds, streamingState, constrainHeight) => {
      mockUseOverflowState.mockReturnValue({ overflowingIds } as NonNullable<
        ReturnType<typeof useOverflowState>
      >);
      mockUseStreamingContext.mockReturnValue(streamingState);
      const { lastFrame } = render(
        <ShowMoreLines constrainHeight={constrainHeight} />,
      );
      expect(lastFrame()).toBe('');
    },
  );

  it('renders message when overflowing while idle', () => {
    mockUseOverflowState.mockReturnValue({
      overflowingIds: new Set(['1']),
    } as NonNullable<ReturnType<typeof useOverflowState>>);
    mockUseStreamingContext.mockReturnValue(StreamingState.Idle);
    const { lastFrame } = render(<ShowMoreLines constrainHeight={true} />);
    expect(lastFrame()).toContain('Press ctrl-o to show more lines');
  });
});
