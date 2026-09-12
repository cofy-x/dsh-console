/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../../test-utils/render.js';
import { HalfLinePaddedBox } from './half-line-padded-box.js';
import { Text, useIsScreenReaderEnabled } from 'ink';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isITerm2, isLowColorDepth } from '../../../terminal/utils.js';
import chalk from 'chalk';
import xterm from '@xterm/headless';
import { UIStateContext, useUIState } from '../../contexts/ui-state-context.js';

vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ink')>();
  return {
    ...actual,
    useIsScreenReaderEnabled: vi.fn(() => false),
  };
});

const originalNoColor = process.env['NO_COLOR'];

function ResizableSurface({ width }: { width: number }) {
  const uiState = useUIState();
  return (
    <UIStateContext.Provider value={{ ...uiState, terminalWidth: width }}>
      <HalfLinePaddedBox
        backgroundBaseColor="blue"
        backgroundOpacity={0.5}
        paintSidePadding
      >
        <Text>{'One\nTwo\nThree'}</Text>
      </HalfLinePaddedBox>
    </UIStateContext.Provider>
  );
}

describe('<HalfLinePaddedBox />', () => {
  beforeEach(() => {
    delete process.env['NO_COLOR'];
    vi.mocked(useIsScreenReaderEnabled).mockReturnValue(false);
    vi.mocked(isLowColorDepth).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalNoColor === undefined) {
      delete process.env['NO_COLOR'];
    } else {
      process.env['NO_COLOR'] = originalNoColor;
    }
  });

  it('renders direct half-block padding when not iTerm2', async () => {
    vi.mocked(isITerm2).mockReturnValue(false);

    const { lastFrame, unmount } = renderWithProviders(
      <HalfLinePaddedBox backgroundBaseColor="blue" backgroundOpacity={0.5}>
        <Text>Content</Text>
      </HalfLinePaddedBox>,
      { width: 10 },
    );

    expect(lastFrame()).toMatchSnapshot();

    unmount();
  });

  it('renders the same direct half-block padding in iTerm2', async () => {
    vi.mocked(isITerm2).mockReturnValue(true);

    const { lastFrame, unmount } = renderWithProviders(
      <HalfLinePaddedBox backgroundBaseColor="blue" backgroundOpacity={0.5}>
        <Text>Content</Text>
      </HalfLinePaddedBox>,
      { width: 10 },
    );

    expect(lastFrame()).toMatchSnapshot();

    unmount();
  });

  it('renders nothing when useBackgroundColor is false', async () => {
    const { lastFrame, unmount } = renderWithProviders(
      <HalfLinePaddedBox
        backgroundBaseColor="blue"
        backgroundOpacity={0.5}
        useBackgroundColor={false}
      >
        <Text>Content</Text>
      </HalfLinePaddedBox>,
      { width: 10 },
    );

    expect(lastFrame()).toMatchSnapshot();

    unmount();
  });

  it.each(['1', '0'])('omits all block decoration for NO_COLOR=%s', (value) => {
    process.env['NO_COLOR'] = value;
    const { lastFrame, unmount } = renderWithProviders(
      <HalfLinePaddedBox
        backgroundBaseColor="blue"
        backgroundOpacity={0.5}
        paintSidePadding
      >
        <Text>Content</Text>
      </HalfLinePaddedBox>,
      { width: 10 },
    );

    expect(lastFrame()).toBe('Content');
    unmount();
  });

  it('keeps the surface when NO_COLOR is empty', () => {
    process.env['NO_COLOR'] = '';
    const { lastFrame, unmount } = renderWithProviders(
      <ResizableSurface width={20} />,
      { width: 20 },
    );

    expect(lastFrame()).toContain('▄');
    expect(lastFrame()).toContain('█');
    expect(lastFrame()).toContain('▀');
    unmount();
  });

  it.each([false, true])(
    'omits decoration for screen readers with paintSidePadding=%s',
    (paintSidePadding) => {
      vi.mocked(useIsScreenReaderEnabled).mockReturnValue(true);
      const { lastFrame, unmount } = renderWithProviders(
        <HalfLinePaddedBox
          backgroundBaseColor="blue"
          backgroundOpacity={0.5}
          paintSidePadding={paintSidePadding}
        >
          <Text>Content</Text>
        </HalfLinePaddedBox>,
        { width: 10 },
      );

      expect(lastFrame()).toBe('Content');
      unmount();
    },
  );

  it.each([
    {
      name: 'truecolor',
      level: 3 as const,
      lowColor: false,
      background: 'black',
    },
    {
      name: '256 colors on black',
      level: 2 as const,
      lowColor: true,
      background: 'black',
    },
    {
      name: '256 colors on white',
      level: 2 as const,
      lowColor: true,
      background: 'white',
    },
    {
      name: '16 colors',
      level: 1 as const,
      lowColor: true,
      background: 'black',
    },
  ])(
    'keeps foreground edges and content geometry stable through redraws and resizing in $name',
    async ({ level, lowColor, background }) => {
      const previousColorLevel = chalk.level;
      chalk.level = level;
      vi.mocked(isLowColorDepth).mockReturnValue(lowColor);
      const terminal = new xterm.Terminal({
        cols: 40,
        rows: 8,
        allowProposedApi: true,
      });

      try {
        const { lastFrame, unmount, rerender } = renderWithProviders(
          <ResizableSurface width={20} />,
          { width: 40, uiState: { terminalBackgroundColor: background } },
        );

        for (const width of [20, 20, 10, 30]) {
          rerender(<ResizableSurface width={width} />);
          terminal.reset();
          await new Promise<void>((resolve) => {
            terminal.write(lastFrame()!.replaceAll('\n', '\r\n'), resolve);
          });

          const content = terminal.buffer.active.getLine(1)!.getCell(1)!;
          expect(content.getChars()).toBe('O');
          expect(content.isBgDefault()).toBe(false);
          for (const [row, glyph] of ['▄', '█', '█', '█', '▀'].entries()) {
            const line = terminal.buffer.active.getLine(row)!;
            for (const column of [0, width - 1]) {
              const cell = line.getCell(column)!;
              expect(cell.getChars()).toBe(glyph);
              expect(cell.isBgDefault()).toBe(true);
              expect(cell.getFgColor()).toBe(content.getBgColor());
            }
            expect(line.getCell(width)!.isBgDefault()).toBe(true);
          }
        }
        unmount();
      } finally {
        terminal.dispose();
        chalk.level = previousColorLevel;
      }
    },
  );
});
