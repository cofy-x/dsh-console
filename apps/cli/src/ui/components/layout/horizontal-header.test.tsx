/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import { HorizontalHeader } from './horizontal-header.js';

describe('<HorizontalHeader />', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a quote, startup quest, and primary entry points', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { lastFrame } = renderWithProviders(
      <HorizontalHeader version="0.1.0-alpha.0" art={'POKEMON\nART\nLINE'} />,
    );
    const output = lastFrame();

    expect(output).toContain('DSH CONSOLE');
    expect(output).toContain('v0.1.0-alpha.0');
    expect(output).toContain('Magikarp used Splash');
    expect(output).toContain("TODAY'S QUEST");
    expect(output).toContain('Find the sharp edges in this codebase.');
    expect(output).toContain('Leave the codebase calmer than you found it.');
    expect(output).toContain('/new Fresh start');
    expect(output).toContain('/sessions Continue');
    expect(output).toContain('/help Explore');
  });

  it('keeps the quest and entry points visible when the quote is truncated', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { lastFrame } = renderWithProviders(
      <HorizontalHeader version="0.1.0-alpha.0" art={'POKEMON\nART\nLINE'} />,
      { width: 70 },
    );
    const output = lastFrame();

    expect(output).toContain("TODAY'S QUEST");
    expect(output).toContain('/new Fresh start');
    expect(output).toContain('/sessions Continue');
    expect(output).toContain('/help Explore');
  });
});
