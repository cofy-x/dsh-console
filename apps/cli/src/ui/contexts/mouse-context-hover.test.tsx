/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'node:events';
import type React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '../../test-utils/render.js';

const mocks = vi.hoisted(() => ({
  disableMouseEvents: vi.fn(),
  enableMouseEvents: vi.fn(),
  stdin: undefined as EventEmitter | undefined,
}));

vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ink')>();
  const ReactModule = await import('react');
  return {
    ...actual,
    useInput: (
      handler: (input: string, key: import('ink').Key) => void,
      options: { isActive?: boolean } = {},
    ) => {
      ReactModule.useEffect(() => {
        if (options.isActive === false) return;

        const handleData = (value: Buffer | string) => {
          const raw =
            typeof value === 'string' ? value : value.toString('utf-8');
          handler(raw.startsWith('\u001b') ? raw.slice(1) : raw, {
            escape: raw === '\u001b',
          } as import('ink').Key);
        };
        mocks.stdin?.on('data', handleData);
        return () => {
          mocks.stdin?.removeListener('data', handleData);
        };
      }, [handler, options.isActive]);
    },
  };
});

vi.mock('../../terminal/mouse.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../terminal/mouse.js')>();
  return {
    ...actual,
    disableMouseEvents: mocks.disableMouseEvents,
    enableMouseEvents: mocks.enableMouseEvents,
  };
});

import { MouseProvider, useMouse } from './mouse-context.js';

function providerWrapper({
  mouseEventsEnabled = true,
  manageTerminalMode = true,
}: {
  mouseEventsEnabled?: boolean;
  manageTerminalMode?: boolean;
} = {}): React.FC<{ children: React.ReactNode }> {
  return function ProviderWrapper({ children }) {
    return (
      <MouseProvider
        mouseEventsEnabled={mouseEventsEnabled}
        manageTerminalMode={manageTerminalMode}
      >
        {children}
      </MouseProvider>
    );
  };
}

describe('MouseProvider hover tracking', () => {
  beforeEach(() => {
    mocks.disableMouseEvents.mockReset();
    mocks.enableMouseEvents.mockReset();
    mocks.stdin = new EventEmitter();
  });

  afterEach(() => {
    mocks.stdin?.removeAllListeners();
  });

  it('installs the listener before any-motion and receives the first passive move', () => {
    const handler = vi.fn();
    mocks.enableMouseEvents.mockImplementationOnce(() => {
      expect(mocks.stdin?.listenerCount('data')).toBe(1);
      mocks.stdin?.emit('data', '\u001b[<35;4;3M');
    });

    const { unmount } = renderHook(
      () => useMouse(handler, { trackingMode: 'any-motion' }),
      { wrapper: providerWrapper() },
    );

    expect(mocks.enableMouseEvents).toHaveBeenCalledWith('any-motion');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'move', button: 'none', col: 4, row: 3 }),
    );
    unmount();
  });

  it('returns to button-motion when the last hover subscription leaves', () => {
    const handler = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useMouse(handler, { isActive, trackingMode: 'any-motion' }),
      {
        initialProps: { isActive: true },
        wrapper: providerWrapper(),
      },
    );

    rerender({ isActive: false });

    expect(mocks.enableMouseEvents).toHaveBeenLastCalledWith('button-motion');
    unmount();
  });

  it('lets only the highest-priority hit handle a passive move', () => {
    const contentHandler = vi.fn(() => true);
    const dialogHandler = vi.fn(() => true);
    const { unmount } = renderHook(
      () => {
        useMouse(contentHandler, {
          priority: 0,
          trackingMode: 'any-motion',
        });
        useMouse(dialogHandler, {
          priority: 100,
          trackingMode: 'any-motion',
        });
      },
      { wrapper: providerWrapper({ manageTerminalMode: false }) },
    );

    act(() => {
      mocks.stdin?.emit('data', '\u001b[<35;4;3M');
    });

    expect(dialogHandler).toHaveBeenCalledOnce();
    expect(contentHandler).not.toHaveBeenCalled();
    unmount();
  });

  it('does not install or enable mouse reporting when disabled', () => {
    const { unmount } = renderHook(
      () => useMouse(vi.fn(), { trackingMode: 'any-motion' }),
      { wrapper: providerWrapper({ mouseEventsEnabled: false }) },
    );

    expect(mocks.stdin?.listenerCount('data')).toBe(0);
    expect(mocks.enableMouseEvents).not.toHaveBeenCalled();
    unmount();
  });

  it('disables all terminal mouse modes when unmounted', () => {
    const { unmount } = renderHook(
      () => useMouse(vi.fn(), { trackingMode: 'any-motion' }),
      { wrapper: providerWrapper() },
    );

    unmount();

    expect(mocks.disableMouseEvents).toHaveBeenCalledOnce();
  });
});
