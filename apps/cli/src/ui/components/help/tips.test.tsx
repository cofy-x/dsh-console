/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { Tips } from './tips.js';
import { describe, it, expect } from 'vitest';

describe('Tips', () => {
  it('renders two actionable tips by default', () => {
    const { lastFrame } = render(<Tips rotationSeed={0} />);
    const output = lastFrame();
    expect(output).toContain('TIPS');
    expect(output).toContain('/btw');
    expect(output).toContain('@path/to/file');
    expect(output).not.toContain('Pokémon');
  });

  it('includes the shuffle tip only when randomized Pokémon are active', () => {
    const { lastFrame } = render(
      <Tips rotationSeed={0.99} showPokemonShuffle />,
    );

    expect(lastFrame()).toContain('Pokémon');
  });
});
