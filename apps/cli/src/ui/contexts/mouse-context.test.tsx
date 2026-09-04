/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook } from '../../test-utils/render.js';
import { act } from 'react';
import { MouseProvider, useMouseContext, useMouse } from './mouse-context.js';
import { vi, type Mock } from 'vitest';
import type React from 'react';
import { useStdin } from 'ink';
import { EventEmitter } from 'node:events';
import { appEvents, AppEvent } from '../../utils/events.js';
import { disableMouseEvents, enableMouseEvents } from '../../terminal/mouse.js';

// Mock the 'ink' module to control stdin
vi.mock('ink', async (importOriginal) => {
  const original = await importOriginal<typeof import('ink')>();
  return {
    ...original,
    useStdin: vi.fn(),
  };
});

vi.mock('../../terminal/mouse.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../terminal/mouse.js')>();
  return {
    ...original,
    enableMouseEvents: vi.fn(),
    disableMouseEvents: vi.fn(),
  };
});

// Mock appEvents
vi.mock('../../utils/events.js', () => ({
  appEvents: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  AppEvent: {
    SelectionWarning: 'selection-warning',
  },
}));

class MockStdin extends EventEmitter {
  isTTY = true;
  setRawMode = vi.fn();
  override on = this.addListener;
  override removeListener = super.removeListener;
  resume = vi.fn();
  pause = vi.fn();

  write(text: string) {
    this.emit('data', text);
  }
}

describe('MouseContext', () => {
  let stdin: MockStdin;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    vi.resetAllMocks();
    stdin = new MockStdin();
    (useStdin as Mock).mockReturnValue({
      stdin,
      setRawMode: vi.fn(),
    });
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <MouseProvider mouseEventsEnabled={true}>{children}</MouseProvider>
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should subscribe and unsubscribe a handler', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useMouseContext(), { wrapper });

    act(() => {
      result.current.subscribe(handler);
    });

    act(() => {
      stdin.write('\x1b[<0;10;20M');
    });

    expect(handler).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.unsubscribe(handler);
    });

    act(() => {
      stdin.write('\x1b[<0;10;20M');
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('enables mouse reporting after installing the stdin listener', () => {
    vi.mocked(enableMouseEvents).mockImplementation(() => {
      expect(stdin.listenerCount('data')).toBeGreaterThan(0);
    });

    const { unmount } = renderHook(() => useMouseContext(), { wrapper });

    expect(enableMouseEvents).toHaveBeenCalledOnce();

    unmount();

    expect(disableMouseEvents).toHaveBeenCalledOnce();
    expect(stdin.listenerCount('data')).toBe(0);
  });

  it('dispatches the first event reported while mouse mode is enabled', () => {
    const handler = vi.fn();
    vi.mocked(enableMouseEvents).mockImplementation(() => {
      stdin.write('\x1b[<0;10;20M');
    });

    renderHook(() => useMouse(handler), { wrapper });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should not call handler if not active', () => {
    const handler = vi.fn();
    renderHook(() => useMouse(handler, { isActive: false }), {
      wrapper,
    });

    act(() => {
      stdin.write('\x1b[<0;10;20M');
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit SelectionWarning when move event is unhandled and has coordinates', () => {
    renderHook(() => useMouseContext(), { wrapper });

    act(() => {
      // Move event (32) at 10, 20
      stdin.write('\x1b[<32;10;20M');
    });

    expect(appEvents.emit).toHaveBeenCalledWith(AppEvent.SelectionWarning);
  });

  it('should not emit SelectionWarning when move event is handled', () => {
    const handler = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useMouseContext(), { wrapper });

    act(() => {
      result.current.subscribe(handler);
    });

    act(() => {
      // Move event (32) at 10, 20
      stdin.write('\x1b[<32;10;20M');
    });

    expect(handler).toHaveBeenCalled();
    expect(appEvents.emit).not.toHaveBeenCalled();
  });

  it('dispatches to the highest-priority handler and stops when consumed', () => {
    const contentHandler = vi.fn().mockReturnValue(true);
    const dialogHandler = vi.fn().mockReturnValue(true);
    const { result } = renderHook(() => useMouseContext(), { wrapper });

    act(() => {
      result.current.subscribe(contentHandler, 0);
      result.current.subscribe(dialogHandler, 100);
      stdin.write('\x1b[<0;10;20M');
    });

    expect(dialogHandler).toHaveBeenCalledTimes(1);
    expect(contentHandler).not.toHaveBeenCalled();
  });

  describe('SGR Mouse Events', () => {
    it.each([
      {
        sequence: '\x1b[<0;10;20M',
        expected: {
          name: 'left-press',
          shift: false,
          ctrl: false,
          meta: false,
        },
      },
      {
        sequence: '\x1b[<0;10;20m',
        expected: {
          name: 'left-release',
          shift: false,
          ctrl: false,
          meta: false,
        },
      },
      {
        sequence: '\x1b[<2;10;20M',
        expected: {
          name: 'right-press',
          shift: false,
          ctrl: false,
          meta: false,
        },
      },
      {
        sequence: '\x1b[<1;10;20M',
        expected: {
          name: 'middle-press',
          shift: false,
          ctrl: false,
          meta: false,
        },
      },
      {
        sequence: '\x1b[<64;10;20M',
        expected: {
          name: 'scroll-up',
          shift: false,
          ctrl: false,
          meta: false,
        },
      },
      {
        sequence: '\x1b[<65;10;20M',
        expected: {
          name: 'scroll-down',
          shift: false,
          ctrl: false,
          meta: false,
        },
      },
      {
        sequence: '\x1b[<32;10;20M',
        expected: {
          name: 'move',
          shift: false,
          ctrl: false,
          meta: false,
        },
      },
      {
        sequence: '\x1b[<4;10;20M',
        expected: { name: 'left-press', shift: true },
      }, // Shift + left press
      {
        sequence: '\x1b[<8;10;20M',
        expected: { name: 'left-press', meta: true },
      }, // Alt + left press
      {
        sequence: '\x1b[<20;10;20M',
        expected: { name: 'left-press', shift: true, ctrl: true },
      }, // Ctrl + Shift + left press
      {
        sequence: '\x1b[<68;10;20M',
        expected: { name: 'scroll-up', shift: true },
      }, // Shift + scroll up
    ])(
      'should recognize sequence "$sequence" as $expected.name',
      ({ sequence, expected }) => {
        const mouseHandler = vi.fn();
        const { result } = renderHook(() => useMouseContext(), { wrapper });
        act(() => result.current.subscribe(mouseHandler));

        act(() => stdin.write(sequence));

        expect(mouseHandler).toHaveBeenCalledWith(
          expect.objectContaining({ ...expected }),
        );
      },
    );
  });
});
