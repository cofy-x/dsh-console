/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import { HorizontalHeader } from './horizontal-header.js';
import { Tips } from '../help/tips.js';

describe('<HorizontalHeader />', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a quote and startup tips', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { lastFrame } = renderWithProviders(
      <HorizontalHeader
        version="0.1.0-alpha.0"
        showVersion
        art={'POKEMON\nART\nLINE'}
        showStartupActions
        startupTips={<Tips rotationSeed={0} />}
      />,
    );
    const output = lastFrame();

    expect(output).toContain('DSH CONSOLE');
    expect(output).toContain('v0.1.0-alpha.0');
    expect(output).toContain('Magikarp used Splash');
    expect(output).toContain('TIPS');
    expect(output).toContain('/btw');
    expect(output).toContain('@path/to/file');
    expect(output).toContain('Resume session · Changelog · Help');
  });

  it('hides the exact version outside debug presentation', () => {
    const { lastFrame } = renderWithProviders(
      <HorizontalHeader version="0.1.0-alpha.0" art="POKEMON" />,
    );

    expect(lastFrame()).not.toContain('v0.1.0-alpha.0');
  });

  it('shows the nightly channel without exposing the exact version', () => {
    const { lastFrame } = renderWithProviders(
      <HorizontalHeader version="0.1.0-alpha.0" nightly art="POKEMON" />,
    );

    expect(lastFrame()).toContain('NIGHTLY');
    expect(lastFrame()).not.toContain('v0.1.0-alpha.0');
  });

  it('keeps tips visible when the quote is truncated', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { lastFrame } = renderWithProviders(
      <HorizontalHeader
        version="0.1.0-alpha.0"
        art={'POKEMON\nART\nLINE'}
        startupTips={<Tips rotationSeed={0} />}
      />,
      { width: 70 },
    );
    const output = lastFrame();

    expect(output).toContain('TIPS');
  });

  it('shuffles random Pokemon artwork when clicked', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onShufflePokemon = vi.fn();
    const { lastFrame, stdin, simulateClick } = renderWithProviders(
      <HorizontalHeader
        version="0.1.0-alpha.0"
        art={'POKEMON\nART\nLINE'}
        onShufflePokemon={onShufflePokemon}
      />,
      { mouseEventsEnabled: true },
    );

    expect(lastFrame()).toContain('Magikarp used Splash');
    await simulateClick(stdin, 2, 2);
    expect(onShufflePokemon).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain('Snorlax is blocking the port.');
  });
});
