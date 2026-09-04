/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import { InteractiveRegion } from './interactive-region.js';

describe('<InteractiveRegion />', () => {
  it('reacts when the first mouse input is a passive move', async () => {
    const onHoverChange = vi.fn();
    const { lastFrame, stdin } = renderWithProviders(
      <InteractiveRegion
        onPress={() => undefined}
        onHoverChange={onHoverChange}
      >
        {({ hovered }) => <Text>{hovered ? 'hovered' : 'idle'}</Text>}
      </InteractiveRegion>,
      { mouseEventsEnabled: true },
    );

    expect(lastFrame()).toContain('idle');

    await act(async () => {
      stdin.write('\u001b[<35;1;1M');
    });

    expect(lastFrame()).toContain('hovered');
    expect(onHoverChange).toHaveBeenCalledOnce();
    expect(onHoverChange).toHaveBeenLastCalledWith(true);
  });
});
