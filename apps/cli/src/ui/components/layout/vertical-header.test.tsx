/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { VerticalHeader } from './vertical-header.js';
import { compactDshLogo } from '../../theme/ascii.js';
import * as semanticColors from '../../theme/colors.js';
import { Text } from 'ink';
import type React from 'react';

vi.mock('../../hooks/visual/use-snow-fall.js', () => ({
  useSnowfall: vi.fn((art) => art),
}));
vi.mock('ink-gradient', () => {
  const MockGradient = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  return {
    default: vi.fn(MockGradient),
  };
});
vi.mock('ink', async () => {
  const originalInk = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...originalInk,
    Text: vi.fn(originalInk.Text),
  };
});
vi.mock('../../contexts/config-context.js', () => ({
  useConfig: vi.fn().mockReturnValue({
    getScreenReader: vi.fn().mockReturnValue(false),
  }),
}));

describe('<VerticalHeader />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the compact DSH logo when no art is available', () => {
    const { lastFrame } = render(
      <VerticalHeader version="1.0.0" nightly={false} terminalWidth={120} />,
    );
    expect(lastFrame()).toContain(compactDshLogo);
  });

  it('renders selected art when it fits the terminal', () => {
    const { lastFrame } = render(
      <VerticalHeader
        version="1.0.0"
        nightly={false}
        terminalWidth={120}
        art="POKEMON ART"
      />,
    );
    expect(lastFrame()).toContain('POKEMON ART');
  });

  it('renders custom ASCII art when provided', () => {
    const customArt = 'CUSTOM ART';
    const { lastFrame } = render(
      <VerticalHeader
        version="1.0.0"
        nightly={false}
        terminalWidth={120}
        customAsciiArt={customArt}
      />,
    );
    expect(lastFrame()).toContain(customArt);
  });

  it('displays the version number when nightly is true', () => {
    const { lastFrame } = render(
      <VerticalHeader version="1.0.0" nightly={true} terminalWidth={120} />,
    );
    expect(lastFrame()).toContain('v1.0.0');
  });

  it('does not display the version number when nightly is false', () => {
    const { lastFrame } = render(
      <VerticalHeader version="1.0.0" nightly={false} terminalWidth={120} />,
    );
    expect(lastFrame()).not.toContain('v1.0.0');
  });

  it('renders with no gradient when theme.ui.gradient is undefined', async () => {
    vi.spyOn(semanticColors, 'theme', 'get').mockReturnValue({
      text: {
        primary: '',
        secondary: '',
        link: '',
        accent: '#123456',
        response: '',
      },
      background: {
        primary: '',
        diff: { added: '', removed: '' },
      },
      border: {
        default: '',
        focused: '',
      },
      ui: {
        comment: '',
        symbol: '',
        dark: '',
        gradient: undefined,
      },
      status: {
        error: '',
        success: '',
        warning: '',
      },
    });
    const Gradient = await import('ink-gradient');
    render(
      <VerticalHeader version="1.0.0" nightly={false} terminalWidth={120} />,
    );
    expect(Gradient.default).not.toHaveBeenCalled();
    const textCalls = (Text as Mock).mock.calls;
    expect(textCalls[0][0]).toHaveProperty('color', '#123456');
  });

  it('renders with a single color when theme.ui.gradient has one color', async () => {
    const singleColor = '#FF0000';
    vi.spyOn(semanticColors, 'theme', 'get').mockReturnValue({
      ui: { gradient: [singleColor] },
    } as typeof semanticColors.theme);
    const Gradient = await import('ink-gradient');
    render(
      <VerticalHeader version="1.0.0" nightly={false} terminalWidth={120} />,
    );
    expect(Gradient.default).not.toHaveBeenCalled();
    const textCalls = (Text as Mock).mock.calls;

    expect(textCalls.length).toBe(1);
    expect(textCalls[0][0]).toHaveProperty('color', singleColor);
  });

  it('renders with a gradient when theme.ui.gradient has two or more colors', async () => {
    const gradientColors = ['#FF0000', '#00FF00'];
    vi.spyOn(semanticColors, 'theme', 'get').mockReturnValue({
      ui: { gradient: gradientColors },
    } as typeof semanticColors.theme);
    const Gradient = await import('ink-gradient');
    render(
      <VerticalHeader version="1.0.0" nightly={false} terminalWidth={120} />,
    );
    expect(Gradient.default).toHaveBeenCalledWith(
      expect.objectContaining({
        colors: gradientColors,
      }),
      undefined,
    );
  });
});
