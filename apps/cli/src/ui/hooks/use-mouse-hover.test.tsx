/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DOMElement } from 'ink';
import type React from 'react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MouseEvent, MouseHandler } from '../../terminal/mouse.js';
import { renderHook } from '../../test-utils/render.js';

const mocks = vi.hoisted(() => ({
  getBoundingBox: vi.fn(),
  handler: undefined as MouseHandler | undefined,
  useMouse: vi.fn((handler: MouseHandler) => {
    mocks.handler = handler;
  }),
}));

vi.mock('ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ink')>();
  return { ...actual, getBoundingBox: mocks.getBoundingBox };
});

vi.mock('../contexts/mouse-context.js', () => ({
  MOUSE_EVENT_PRIORITY: { content: 0, interactive: 10, dialog: 100 },
  useMouse: mocks.useMouse,
}));

import { useMouseHover } from './use-mouse-hover.js';

function passiveMove(col: number, row: number): MouseEvent {
  return {
    name: 'move',
    button: 'none',
    col,
    row,
    ctrl: false,
    meta: false,
    shift: false,
  };
}

describe('useMouseHover', () => {
  beforeEach(() => {
    mocks.getBoundingBox.mockReset();
    mocks.useMouse.mockClear();
    mocks.handler = undefined;
  });

  it('tracks the first passive move, exit, and ignores unchanged state', () => {
    mocks.getBoundingBox.mockReturnValue({
      x: 2,
      y: 3,
      width: 5,
      height: 2,
    });
    const onHoverChange = vi.fn();
    const ref = {
      current: {} as DOMElement,
    } as React.RefObject<DOMElement | null>;
    const { result } = renderHook(() => useMouseHover(ref, { onHoverChange }));

    expect(mocks.useMouse).toHaveBeenCalledWith(expect.any(Function), {
      isActive: true,
      priority: 10,
      trackingMode: 'any-motion',
    });

    act(() => {
      expect(mocks.handler?.(passiveMove(3, 4))).toBe(true);
    });
    expect(result.current).toBe(true);
    expect(onHoverChange).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenLastCalledWith(true);

    act(() => {
      expect(mocks.handler?.(passiveMove(4, 4))).toBe(true);
    });
    expect(result.current).toBe(true);
    expect(onHoverChange).toHaveBeenCalledTimes(1);

    act(() => {
      expect(mocks.handler?.(passiveMove(9, 8))).toBe(false);
    });
    expect(result.current).toBe(false);
    expect(onHoverChange).toHaveBeenCalledTimes(2);
    expect(onHoverChange).toHaveBeenLastCalledWith(false);
  });
});
