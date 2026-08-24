/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import stripAnsi from 'strip-ansi';
import { act } from 'react';
import {
  renderHook,
  renderHookWithProviders,
} from '../../../test-utils/render.js';
import type { Viewport, TextBuffer } from './use-text-buffer.js';
import { useTextBuffer } from './use-text-buffer.js';
import { offsetToLogicalPos } from '../../input/buffer/utils.js';

const getBufferState = (result: { current: TextBuffer }) => {
  expect(result.current).toHaveOnlyValidCharacters();
  return {
    text: result.current.text,
    lines: [...result.current.lines], // Clone for safety
    cursor: [...result.current.cursor] as [number, number],
    allVisualLines: [...result.current.allVisualLines],
    viewportVisualLines: [...result.current.viewportVisualLines],
    visualCursor: [...result.current.visualCursor] as [number, number],
    visualScrollRow: result.current.visualScrollRow,
    preferredCol: result.current.preferredCol,
  };
};

describe('useTextBuffer', () => {
  let viewport: Viewport;

  beforeEach(() => {
    viewport = { width: 10, height: 3 }; // Default viewport for tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with empty text and cursor at (0,0) by default', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const state = getBufferState(result);
      expect(state.text).toBe('');
      expect(state.lines).toEqual(['']);
      expect(state.cursor).toEqual([0, 0]);
      expect(state.allVisualLines).toEqual(['']);
      expect(state.viewportVisualLines).toEqual(['']);
      expect(state.visualCursor).toEqual([0, 0]);
      expect(state.visualScrollRow).toBe(0);
    });

    it('should initialize with provided initialText', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'hello',
          viewport,
          isValidPath: () => false,
        }),
      );
      const state = getBufferState(result);
      expect(state.text).toBe('hello');
      expect(state.lines).toEqual(['hello']);
      expect(state.cursor).toEqual([0, 0]); // Default cursor if offset not given
      expect(state.allVisualLines).toEqual(['hello']);
      expect(state.viewportVisualLines).toEqual(['hello']);
      expect(state.visualCursor).toEqual([0, 0]);
    });

    it('should initialize with initialText and initialCursorOffset', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'hello\nworld',
          initialCursorOffset: 7, // Should be at 'o' in 'world'
          viewport,
          isValidPath: () => false,
        }),
      );
      const state = getBufferState(result);
      expect(state.text).toBe('hello\nworld');
      expect(state.lines).toEqual(['hello', 'world']);
      expect(state.cursor).toEqual([1, 1]); // Logical cursor at 'o' in "world"
      expect(state.allVisualLines).toEqual(['hello', 'world']);
      expect(state.viewportVisualLines).toEqual(['hello', 'world']);
      expect(state.visualCursor[0]).toBe(1); // On the second visual line
      expect(state.visualCursor[1]).toBe(1); // At 'o' in "world"
    });

    it('should wrap visual lines', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'The quick brown fox jumps over the lazy dog.',
          initialCursorOffset: 2, // After '好'
          viewport: { width: 15, height: 4 },
          isValidPath: () => false,
        }),
      );
      const state = getBufferState(result);
      expect(state.allVisualLines).toEqual([
        'The quick',
        'brown fox',
        'jumps over the',
        'lazy dog.',
      ]);
    });

    it('should wrap visual lines with multiple spaces', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'The  quick  brown fox    jumps over the lazy dog.',
          viewport: { width: 15, height: 4 },
          isValidPath: () => false,
        }),
      );
      const state = getBufferState(result);
      // Including multiple spaces at the end of the lines like this is
      // consistent with Google docs behavior and makes it intuitive to edit
      // the spaces as needed.
      expect(state.allVisualLines).toEqual([
        'The  quick ',
        'brown fox   ',
        'jumps over the',
        'lazy dog.',
      ]);
    });

    it('should wrap visual lines even without spaces', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '123456789012345ABCDEFG', // 4 chars, 12 bytes
          viewport: { width: 15, height: 2 },
          isValidPath: () => false,
        }),
      );
      const state = getBufferState(result);
      // Including multiple spaces at the end of the lines like this is
      // consistent with Google docs behavior and makes it intuitive to edit
      // the spaces as needed.
      expect(state.allVisualLines).toEqual(['123456789012345', 'ABCDEFG']);
    });

    it('should initialize with multi-byte unicode characters and correct cursor offset', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '你好世界', // 4 chars, 12 bytes
          initialCursorOffset: 2, // After '好'
          viewport: { width: 5, height: 2 },
          isValidPath: () => false,
        }),
      );
      const state = getBufferState(result);
      expect(state.text).toBe('你好世界');
      expect(state.lines).toEqual(['你好世界']);
      expect(state.cursor).toEqual([0, 2]);
      // Visual: "你好" (width 4), "世"界" (width 4) with viewport width 5
      expect(state.allVisualLines).toEqual(['你好', '世界']);
      expect(state.visualCursor).toEqual([1, 0]);
    });
  });

  describe('Basic Editing', () => {
    it('insert: should insert a character and update cursor', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() => result.current.insert('a'));
      let state = getBufferState(result);
      expect(state.text).toBe('a');
      expect(state.cursor).toEqual([0, 1]);
      expect(state.visualCursor).toEqual([0, 1]);

      act(() => result.current.insert('b'));
      state = getBufferState(result);
      expect(state.text).toBe('ab');
      expect(state.cursor).toEqual([0, 2]);
      expect(state.visualCursor).toEqual([0, 2]);
    });

    it('insert: should insert text in the middle of a line', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'abc',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('right'));
      act(() => result.current.insert('-NEW-'));
      const state = getBufferState(result);
      expect(state.text).toBe('a-NEW-bc');
      expect(state.cursor).toEqual([0, 6]);
    });

    it('insert: should use placeholder for large text paste', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const largeText = '1\n2\n3\n4\n5\n6';
      act(() => result.current.insert(largeText, { paste: true }));
      const state = getBufferState(result);
      expect(state.text).toBe('[Pasted Text: 6 lines]');
      expect(result.current.pastedContent['[Pasted Text: 6 lines]']).toBe(
        largeText,
      );
    });

    it('insert: should NOT use placeholder for large text if NOT a paste', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const largeText = '1\n2\n3\n4\n5\n6';
      act(() => result.current.insert(largeText, { paste: false }));
      const state = getBufferState(result);
      expect(state.text).toBe(largeText);
    });

    it('insert: should clean up pastedContent when placeholder is deleted', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const largeText = '1\n2\n3\n4\n5\n6';
      act(() => result.current.insert(largeText, { paste: true }));
      expect(result.current.pastedContent['[Pasted Text: 6 lines]']).toBe(
        largeText,
      );

      // Delete the placeholder using setText
      act(() => result.current.setText(''));
      expect(Object.keys(result.current.pastedContent)).toHaveLength(0);
    });

    it('insert: should clean up pastedContent when placeholder is removed via atomic backspace', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const largeText = '1\n2\n3\n4\n5\n6';
      act(() => result.current.insert(largeText, { paste: true }));
      expect(result.current.pastedContent['[Pasted Text: 6 lines]']).toBe(
        largeText,
      );

      // Single backspace at end of placeholder removes entire placeholder
      act(() => {
        result.current.backspace();
      });

      expect(getBufferState(result).text).toBe('');
      // pastedContent is cleaned up when placeholder is deleted atomically
      expect(Object.keys(result.current.pastedContent)).toHaveLength(0);
    });

    it('newline: should create a new line and move cursor', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'ab',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end')); // cursor at [0,2]
      act(() => result.current.newline());
      const state = getBufferState(result);
      expect(state.text).toBe('ab\n');
      expect(state.lines).toEqual(['ab', '']);
      expect(state.cursor).toEqual([1, 0]);
      expect(state.allVisualLines).toEqual(['ab', '']);
      expect(state.viewportVisualLines).toEqual(['ab', '']); // viewport height 3
      expect(state.visualCursor).toEqual([1, 0]); // On the new visual line
    });

    it('backspace: should delete char to the left or merge lines', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'a\nb',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => {
        result.current.move('down');
      });
      act(() => {
        result.current.move('end'); // cursor to [1,1] (end of 'b')
      });
      act(() => result.current.backspace()); // delete 'b'
      let state = getBufferState(result);
      expect(state.text).toBe('a\n');
      expect(state.cursor).toEqual([1, 0]);

      act(() => result.current.backspace()); // merge lines
      state = getBufferState(result);
      expect(state.text).toBe('a');
      expect(state.cursor).toEqual([0, 1]); // cursor after 'a'
      expect(state.allVisualLines).toEqual(['a']);
      expect(state.viewportVisualLines).toEqual(['a']);
      expect(state.visualCursor).toEqual([0, 1]);
    });

    it('del: should delete char to the right or merge lines', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'a\nb',
          viewport,
          isValidPath: () => false,
        }),
      );
      // cursor at [0,0]
      act(() => result.current.del()); // delete 'a'
      let state = getBufferState(result);
      expect(state.text).toBe('\nb');
      expect(state.cursor).toEqual([0, 0]);

      act(() => result.current.del()); // merge lines (deletes newline)
      state = getBufferState(result);
      expect(state.text).toBe('b');
      expect(state.cursor).toEqual([0, 0]);
      expect(state.allVisualLines).toEqual(['b']);
      expect(state.viewportVisualLines).toEqual(['b']);
      expect(state.visualCursor).toEqual([0, 0]);
    });
  });

  describe('Drag and Drop File Paths', () => {
    it('should prepend @ to a valid file path on insert', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => true }),
      );
      const filePath = '/path/to/a/valid/file.txt';
      act(() => result.current.insert(filePath, { paste: true }));
      expect(getBufferState(result).text).toBe(`@${filePath} `);
    });

    it('should not prepend @ to an invalid file path on insert', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const notAPath = 'this is just some long text';
      act(() => result.current.insert(notAPath, { paste: true }));
      expect(getBufferState(result).text).toBe(notAPath);
    });

    it('should handle quoted paths', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => true }),
      );
      const filePath = "'/path/to/a/valid/file.txt'";
      act(() => result.current.insert(filePath, { paste: true }));
      expect(getBufferState(result).text).toBe(`@/path/to/a/valid/file.txt `);
    });

    it('should not prepend @ to short text that is not a path', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => true }),
      );
      const shortText = 'ab';
      act(() => result.current.insert(shortText, { paste: true }));
      expect(getBufferState(result).text).toBe(shortText);
    });

    it('should prepend @ to multiple valid file paths on insert', () => {
      // Use Set to model reality: individual paths exist, combined string doesn't
      const validPaths = new Set(['/path/to/file1.txt', '/path/to/file2.txt']);
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: (p) => validPaths.has(p) }),
      );
      const filePaths = '/path/to/file1.txt /path/to/file2.txt';
      act(() => result.current.insert(filePaths, { paste: true }));
      expect(getBufferState(result).text).toBe(
        '@/path/to/file1.txt @/path/to/file2.txt ',
      );
    });

    it('should handle multiple paths with escaped spaces', () => {
      // Use Set to model reality: individual paths exist, combined string doesn't
      const validPaths = new Set(['/path/to/my file.txt', '/other/path.txt']);
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: (p) => validPaths.has(p) }),
      );
      const filePaths = '/path/to/my\\ file.txt /other/path.txt';
      act(() => result.current.insert(filePaths, { paste: true }));
      expect(getBufferState(result).text).toBe(
        '@/path/to/my\\ file.txt @/other/path.txt ',
      );
    });

    it('should only prepend @ to valid paths in multi-path paste', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: (p) => p.endsWith('.txt'),
        }),
      );
      const filePaths = '/valid/file.txt /invalid/file.jpg';
      act(() => result.current.insert(filePaths, { paste: true }));
      expect(getBufferState(result).text).toBe(
        '@/valid/file.txt /invalid/file.jpg ',
      );
    });
  });

  describe('Shell Mode Behavior', () => {
    it('should not prepend @ to valid file paths when shellModeActive is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => true,
          shellModeActive: true,
        }),
      );
      const filePath = '/path/to/a/valid/file.txt';
      act(() => result.current.insert(filePath, { paste: true }));
      expect(getBufferState(result).text).toBe(filePath); // No @ prefix
    });

    it('should not prepend @ to quoted paths when shellModeActive is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => true,
          shellModeActive: true,
        }),
      );
      const quotedFilePath = "'/path/to/a/valid/file.txt'";
      act(() => result.current.insert(quotedFilePath, { paste: true }));
      expect(getBufferState(result).text).toBe(quotedFilePath); // No @ prefix, keeps quotes
    });

    it('should behave normally with invalid paths when shellModeActive is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          shellModeActive: true,
        }),
      );
      const notAPath = 'this is just some text';
      act(() => result.current.insert(notAPath, { paste: true }));
      expect(getBufferState(result).text).toBe(notAPath);
    });

    it('should behave normally with short text when shellModeActive is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => true,
          shellModeActive: true,
        }),
      );
      const shortText = 'ls';
      act(() => result.current.insert(shortText, { paste: true }));
      expect(getBufferState(result).text).toBe(shortText); // No @ prefix for short text
    });
  });

  describe('Cursor Movement', () => {
    it('move: left/right should work within and across visual lines (due to wrapping)', () => {
      // Text: "long line1next line2" (20 chars)
      // Viewport width 5. Word wrapping should produce:
      // "long " (5)
      // "line1" (5)
      // "next " (5)
      // "line2" (5)
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'long line1next line2', // Corrected: was 'long line1next line2'
          viewport: { width: 5, height: 4 },
          isValidPath: () => false,
        }),
      );
      // Initial cursor [0,0] logical, visual [0,0] ("l" of "long ")

      act(() => result.current.move('right')); // visual [0,1] ("o")
      expect(getBufferState(result).visualCursor).toEqual([0, 1]);
      act(() => result.current.move('right')); // visual [0,2] ("n")
      act(() => result.current.move('right')); // visual [0,3] ("g")
      act(() => result.current.move('right')); // visual [0,4] (" ")
      expect(getBufferState(result).visualCursor).toEqual([0, 4]);

      act(() => result.current.move('right')); // visual [1,0] ("l" of "line1")
      expect(getBufferState(result).visualCursor).toEqual([1, 0]);
      expect(getBufferState(result).cursor).toEqual([0, 5]); // logical cursor

      act(() => result.current.move('left')); // visual [0,4] (" " of "long ")
      expect(getBufferState(result).visualCursor).toEqual([0, 4]);
      expect(getBufferState(result).cursor).toEqual([0, 4]); // logical cursor
    });

    it('move: up/down should preserve preferred visual column', () => {
      const text = 'abcde\nxy\n12345';
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: text,
          viewport,
          isValidPath: () => false,
        }),
      );
      expect(result.current.allVisualLines).toEqual(['abcde', 'xy', '12345']);
      // Place cursor at the end of "abcde" -> logical [0,5]
      act(() => {
        result.current.move('home'); // to [0,0]
      });
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.move('right'); // to [0,5]
        });
      }
      expect(getBufferState(result).cursor).toEqual([0, 5]);
      expect(getBufferState(result).visualCursor).toEqual([0, 5]);

      // Set preferredCol by moving up then down to the same spot, then test.
      act(() => {
        result.current.move('down'); // to xy, logical [1,2], visual [1,2], preferredCol should be 5
      });
      let state = getBufferState(result);
      expect(state.cursor).toEqual([1, 2]); // Logical cursor at end of 'xy'
      expect(state.visualCursor).toEqual([1, 2]); // Visual cursor at end of 'xy'
      expect(state.preferredCol).toBe(5);

      act(() => result.current.move('down')); // to '12345', preferredCol=5.
      state = getBufferState(result);
      expect(state.cursor).toEqual([2, 5]); // Logical cursor at end of '12345'
      expect(state.visualCursor).toEqual([2, 5]); // Visual cursor at end of '12345'
      expect(state.preferredCol).toBe(5); // Preferred col is maintained

      act(() => result.current.move('left')); // preferredCol should reset
      state = getBufferState(result);
      expect(state.preferredCol).toBe(null);
    });

    it('move: home/end should go to visual line start/end', () => {
      const initialText = 'line one\nsecond line';
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText,
          viewport: { width: 5, height: 5 },
          isValidPath: () => false,
        }),
      );
      expect(result.current.allVisualLines).toEqual([
        'line',
        'one',
        'secon',
        'd',
        'line',
      ]);
      // Initial cursor [0,0] (start of "line")
      act(() => result.current.move('down')); // visual cursor from [0,0] to [1,0] ("o" of "one")
      act(() => result.current.move('right')); // visual cursor to [1,1] ("n" of "one")
      expect(getBufferState(result).visualCursor).toEqual([1, 1]);

      act(() => result.current.move('home')); // visual cursor to [1,0] (start of "one")
      expect(getBufferState(result).visualCursor).toEqual([1, 0]);

      act(() => result.current.move('end')); // visual cursor to [1,3] (end of "one")
      expect(getBufferState(result).visualCursor).toEqual([1, 3]); // "one" is 3 chars
    });
  });

  describe('Visual Layout & Viewport', () => {
    it('should wrap long lines correctly into visualLines', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'This is a very long line of text.', // 33 chars
          viewport: { width: 10, height: 5 },
          isValidPath: () => false,
        }),
      );
      const state = getBufferState(result);
      // Expected visual lines with word wrapping (viewport width 10):
      // "This is a"
      // "very long"
      // "line of"
      // "text."
      expect(state.allVisualLines.length).toBe(4);
      expect(state.allVisualLines[0]).toBe('This is a');
      expect(state.allVisualLines[1]).toBe('very long');
      expect(state.allVisualLines[2]).toBe('line of');
      expect(state.allVisualLines[3]).toBe('text.');
    });

    it('should update visualScrollRow when visualCursor moves out of viewport', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'l1\nl2\nl3\nl4\nl5',
          viewport: { width: 5, height: 3 }, // Can show 3 visual lines
          isValidPath: () => false,
        }),
      );
      // Initial: l1, l2, l3 visible. visualScrollRow = 0. visualCursor = [0,0]
      expect(getBufferState(result).visualScrollRow).toBe(0);
      expect(getBufferState(result).allVisualLines).toEqual([
        'l1',
        'l2',
        'l3',
        'l4',
        'l5',
      ]);
      expect(getBufferState(result).viewportVisualLines).toEqual([
        'l1',
        'l2',
        'l3',
      ]);

      act(() => result.current.move('down')); // vc=[1,0]
      act(() => result.current.move('down')); // vc=[2,0] (l3)
      expect(getBufferState(result).visualScrollRow).toBe(0);

      act(() => result.current.move('down')); // vc=[3,0] (l4) - scroll should happen
      // Now: l2, l3, l4 visible. visualScrollRow = 1.
      let state = getBufferState(result);
      expect(state.visualScrollRow).toBe(1);
      expect(state.allVisualLines).toEqual(['l1', 'l2', 'l3', 'l4', 'l5']);
      expect(state.viewportVisualLines).toEqual(['l2', 'l3', 'l4']);
      expect(state.visualCursor).toEqual([3, 0]);

      act(() => result.current.move('up')); // vc=[2,0] (l3)
      act(() => result.current.move('up')); // vc=[1,0] (l2)
      expect(getBufferState(result).visualScrollRow).toBe(1);

      act(() => result.current.move('up')); // vc=[0,0] (l1) - scroll up
      // Now: l1, l2, l3 visible. visualScrollRow = 0
      state = getBufferState(result); // Assign to the existing `state` variable
      expect(state.visualScrollRow).toBe(0);
      expect(state.allVisualLines).toEqual(['l1', 'l2', 'l3', 'l4', 'l5']);
      expect(state.viewportVisualLines).toEqual(['l1', 'l2', 'l3']);
      expect(state.visualCursor).toEqual([0, 0]);
    });
  });

  describe('Undo/Redo', () => {
    it('should undo and redo an insert operation', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() => result.current.insert('a'));
      expect(getBufferState(result).text).toBe('a');

      act(() => result.current.undo());
      expect(getBufferState(result).text).toBe('');
      expect(getBufferState(result).cursor).toEqual([0, 0]);

      act(() => result.current.redo());
      expect(getBufferState(result).text).toBe('a');
      expect(getBufferState(result).cursor).toEqual([0, 1]);
    });

    it('should undo and redo a newline operation', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'test',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end'));
      act(() => result.current.newline());
      expect(getBufferState(result).text).toBe('test\n');

      act(() => result.current.undo());
      expect(getBufferState(result).text).toBe('test');
      expect(getBufferState(result).cursor).toEqual([0, 4]);

      act(() => result.current.redo());
      expect(getBufferState(result).text).toBe('test\n');
      expect(getBufferState(result).cursor).toEqual([1, 0]);
    });
  });

  describe('Unicode Handling', () => {
    it('insert: should correctly handle multi-byte unicode characters', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() => result.current.insert('你好'));
      const state = getBufferState(result);
      expect(state.text).toBe('你好');
      expect(state.cursor).toEqual([0, 2]); // Cursor is 2 (char count)
      expect(state.visualCursor).toEqual([0, 2]);
    });

    it('backspace: should correctly delete multi-byte unicode characters', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '你好',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end')); // cursor at [0,2]
      act(() => result.current.backspace()); // delete '好'
      let state = getBufferState(result);
      expect(state.text).toBe('你');
      expect(state.cursor).toEqual([0, 1]);

      act(() => result.current.backspace()); // delete '你'
      state = getBufferState(result);
      expect(state.text).toBe('');
      expect(state.cursor).toEqual([0, 0]);
    });

    it('move: left/right should treat multi-byte chars as single units for visual cursor', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '🐶🐱',
          viewport: { width: 5, height: 1 },
          isValidPath: () => false,
        }),
      );
      // Initial: visualCursor [0,0]
      act(() => result.current.move('right')); // visualCursor [0,1] (after 🐶)
      let state = getBufferState(result);
      expect(state.cursor).toEqual([0, 1]);
      expect(state.visualCursor).toEqual([0, 1]);

      act(() => result.current.move('right')); // visualCursor [0,2] (after 🐱)
      state = getBufferState(result);
      expect(state.cursor).toEqual([0, 2]);
      expect(state.visualCursor).toEqual([0, 2]);

      act(() => result.current.move('left')); // visualCursor [0,1] (before 🐱 / after 🐶)
      state = getBufferState(result);
      expect(state.cursor).toEqual([0, 1]);
      expect(state.visualCursor).toEqual([0, 1]);
    });

    it('moveToVisualPosition: should correctly handle wide characters (Chinese)', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '你好', // 2 chars, width 4
          viewport: { width: 10, height: 1 },
          isValidPath: () => false,
        }),
      );

      // '你' (width 2): visual 0-1. '好' (width 2): visual 2-3.

      // Click on '你' (first half, x=0) -> index 0
      act(() => result.current.moveToVisualPosition(0, 0));
      expect(getBufferState(result).cursor).toEqual([0, 0]);

      // Click on '你' (second half, x=1) -> index 1 (after first char)
      act(() => result.current.moveToVisualPosition(0, 1));
      expect(getBufferState(result).cursor).toEqual([0, 1]);

      // Click on '好' (first half, x=2) -> index 1 (before second char)
      act(() => result.current.moveToVisualPosition(0, 2));
      expect(getBufferState(result).cursor).toEqual([0, 1]);

      // Click on '好' (second half, x=3) -> index 2 (after second char)
      act(() => result.current.moveToVisualPosition(0, 3));
      expect(getBufferState(result).cursor).toEqual([0, 2]);
    });
  });

  describe('handleInput', () => {
    it('should insert printable characters', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() =>
        result.current.handleInput({
          name: 'h',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: 'h',
        }),
      );
      act(() =>
        result.current.handleInput({
          name: 'i',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: 'i',
        }),
      );
      expect(getBufferState(result).text).toBe('hi');
    });

    it('should handle "Enter" key as newline', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() =>
        result.current.handleInput({
          name: 'return',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: '\r',
        }),
      );
      expect(getBufferState(result).lines).toEqual(['', '']);
    });

    it('should handle Ctrl+J as newline', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() =>
        result.current.handleInput({
          name: 'j',
          shift: false,
          alt: false,
          ctrl: true,
          cmd: false,
          insertable: false,
          sequence: '\n',
        }),
      );
      expect(getBufferState(result).lines).toEqual(['', '']);
    });

    it('should do nothing for a tab key press', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() =>
        result.current.handleInput({
          name: 'tab',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\t',
        }),
      );
      expect(getBufferState(result).text).toBe('');
    });

    it('should do nothing for a shift tab key press', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() =>
        result.current.handleInput({
          name: 'tab',
          shift: true,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\u001b[9;2u',
        }),
      );
      expect(getBufferState(result).text).toBe('');
    });

    it('should handle "Backspace" key', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'a',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end'));
      act(() =>
        result.current.handleInput({
          name: 'backspace',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\x7f',
        }),
      );
      expect(getBufferState(result).text).toBe('');
    });

    it('should handle multiple delete characters in one input', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'abcde',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end')); // cursor at the end
      expect(getBufferState(result).cursor).toEqual([0, 5]);

      act(() => {
        result.current.handleInput({
          name: 'backspace',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\x7f',
        });
        result.current.handleInput({
          name: 'backspace',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\x7f',
        });
        result.current.handleInput({
          name: 'backspace',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\x7f',
        });
      });
      expect(getBufferState(result).text).toBe('ab');
      expect(getBufferState(result).cursor).toEqual([0, 2]);
    });

    it('should handle inserts that contain delete characters', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'abcde',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end')); // cursor at the end
      expect(getBufferState(result).cursor).toEqual([0, 5]);

      act(() => {
        result.current.insert('\x7f\x7f\x7f');
      });
      expect(getBufferState(result).text).toBe('ab');
      expect(getBufferState(result).cursor).toEqual([0, 2]);
    });

    it('should handle inserts with a mix of regular and delete characters', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'abcde',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end')); // cursor at the end
      expect(getBufferState(result).cursor).toEqual([0, 5]);

      act(() => {
        result.current.insert('\x7fI\x7f\x7fNEW');
      });
      expect(getBufferState(result).text).toBe('abcNEW');
      expect(getBufferState(result).cursor).toEqual([0, 6]);
    });

    it('should handle arrow keys for movement', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'ab',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.move('end')); // cursor [0,2]
      act(() =>
        result.current.handleInput({
          name: 'left',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\x1b[D',
        }),
      );
      expect(getBufferState(result).cursor).toEqual([0, 1]);
      act(() =>
        result.current.handleInput({
          name: 'right',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\x1b[C',
        }),
      );
      expect(getBufferState(result).cursor).toEqual([0, 2]);
    });

    it('should strip ANSI escape codes when pasting text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const textWithAnsi = '\x1B[31mHello\x1B[0m \x1B[32mWorld\x1B[0m';
      // Simulate pasting by calling handleInput with a string longer than 1 char
      act(() =>
        result.current.handleInput({
          name: '',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: textWithAnsi,
        }),
      );
      expect(getBufferState(result).text).toBe('Hello World');
    });

    it('should handle VSCode terminal Shift+Enter as newline', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() =>
        result.current.handleInput({
          name: 'return',
          shift: true,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: '\r',
        }),
      ); // Simulates Shift+Enter in VSCode terminal
      expect(getBufferState(result).lines).toEqual(['', '']);
    });

    it('should correctly handle repeated pasting of long text', () => {
      const longText = `not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.

Why do we use it?
It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).

Where does it come from?
Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words, consectetur, from a Lore
`;
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );

      // Simulate pasting the long text multiple times
      act(() => {
        result.current.insert(longText, { paste: true });
        result.current.insert(longText, { paste: true });
        result.current.insert(longText, { paste: true });
      });

      const state = getBufferState(result);
      // Check that the text is the result of three concatenations of unique placeholders.
      // Now that ID generation is in the reducer, they are correctly unique even when batched.
      expect(state.lines).toStrictEqual([
        '[Pasted Text: 8 lines][Pasted Text: 8 lines #2][Pasted Text: 8 lines #3]',
      ]);
      expect(result.current.pastedContent['[Pasted Text: 8 lines]']).toBe(
        longText,
      );
      expect(result.current.pastedContent['[Pasted Text: 8 lines #2]']).toBe(
        longText,
      );
      expect(result.current.pastedContent['[Pasted Text: 8 lines #3]']).toBe(
        longText,
      );
      const expectedCursorPos = offsetToLogicalPos(
        state.text,
        state.text.length,
      );
      expect(state.cursor).toEqual(expectedCursorPos);
    });
  });

  // More tests would be needed for:
  // - setText, replaceRange
  // - deleteWordLeft, deleteWordRight
  // - More complex undo/redo scenarios
  // - Selection and clipboard (copy/paste) - might need clipboard API mocks or internal state check
  // - openInExternalEditor (heavy mocking of fs, child_process, os)
  // - All edge cases for visual scrolling and wrapping with different viewport sizes and text content.

  describe('replaceRange', () => {
    it('should replace a single-line range with single-line text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '@pac',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 1, 0, 4, 'packages'));
      const state = getBufferState(result);
      expect(state.text).toBe('@packages');
      expect(state.cursor).toEqual([0, 9]); // cursor after 'typescript'
    });

    it('should replace a multi-line range with single-line text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'hello\nworld\nagain',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 2, 1, 3, ' new ')); // replace 'llo\nwor' with ' new '
      const state = getBufferState(result);
      expect(state.text).toBe('he new ld\nagain');
      expect(state.cursor).toEqual([0, 7]); // cursor after ' new '
    });

    it('should delete a range when replacing with an empty string', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'hello world',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 5, 0, 11, '')); // delete ' world'
      const state = getBufferState(result);
      expect(state.text).toBe('hello');
      expect(state.cursor).toEqual([0, 5]);
    });

    it('should handle replacing at the beginning of the text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'world',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 0, 0, 0, 'hello '));
      const state = getBufferState(result);
      expect(state.text).toBe('hello world');
      expect(state.cursor).toEqual([0, 6]);
    });

    it('should handle replacing at the end of the text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'hello',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 5, 0, 5, ' world'));
      const state = getBufferState(result);
      expect(state.text).toBe('hello world');
      expect(state.cursor).toEqual([0, 11]);
    });

    it('should handle replacing the entire buffer content', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'old text',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 0, 0, 8, 'new text'));
      const state = getBufferState(result);
      expect(state.text).toBe('new text');
      expect(state.cursor).toEqual([0, 8]);
    });

    it('should correctly replace with unicode characters', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'hello *** world',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 6, 0, 9, '你好'));
      const state = getBufferState(result);
      expect(state.text).toBe('hello 你好 world');
      expect(state.cursor).toEqual([0, 8]); // after '你好'
    });

    it('should handle invalid range by returning false and not changing text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'test',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => {
        result.current.replaceRange(0, 5, 0, 3, 'fail'); // startCol > endCol in same line
      });

      expect(getBufferState(result).text).toBe('test');

      act(() => {
        result.current.replaceRange(1, 0, 0, 0, 'fail'); // startRow > endRow
      });
      expect(getBufferState(result).text).toBe('test');
    });

    it('replaceRange: multiple lines with a single character', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'first\nsecond\nthird',
          viewport,
          isValidPath: () => false,
        }),
      );
      act(() => result.current.replaceRange(0, 2, 2, 3, 'X')); // Replace 'rst\nsecond\nthi'
      const state = getBufferState(result);
      expect(state.text).toBe('fiXrd');
      expect(state.cursor).toEqual([0, 3]); // After 'X'
    });

    it('should replace a single-line range with multi-line text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'one two three',
          viewport,
          isValidPath: () => false,
        }),
      );
      // Replace "two" with "new\nline"
      act(() => result.current.replaceRange(0, 4, 0, 7, 'new\nline'));
      const state = getBufferState(result);
      expect(state.lines).toEqual(['one new', 'line three']);
      expect(state.text).toBe('one new\nline three');
      expect(state.cursor).toEqual([1, 4]); // cursor after 'line'
    });
  });

  describe('Input Sanitization', () => {
    const createInput = (sequence: string) => ({
      name: '',
      shift: false,
      alt: false,
      ctrl: false,
      cmd: false,
      insertable: true,
      sequence,
    });
    it.each([
      {
        input: '\x1B[31mHello\x1B[0m \x1B[32mWorld\x1B[0m',
        expected: 'Hello World',
        desc: 'ANSI escape codes',
      },
      {
        input: 'H\x07e\x08l\x0Bl\x0Co',
        expected: 'Hello',
        desc: 'control characters',
      },
      {
        input: '\u001B[4mH\u001B[0mello',
        expected: 'Hello',
        desc: 'mixed ANSI and control characters',
      },
      {
        input: '\u001B[4mPasted\u001B[4m Text',
        expected: 'Pasted Text',
        desc: 'pasted text with ANSI',
      },
    ])('should strip $desc from input', ({ input, expected }) => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      act(() => result.current.handleInput(createInput(input)));
      expect(getBufferState(result).text).toBe(expected);
    });

    it('should not strip standard characters or newlines', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const validText = 'Hello World\nThis is a test.';
      act(() => result.current.handleInput(createInput(validText)));
      expect(getBufferState(result).text).toBe(validText);
    });

    it('should sanitize large text (>5000 chars) and strip unsafe characters', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const unsafeChars = '\x07\x08\x0B\x0C';
      const largeTextWithUnsafe =
        'safe text'.repeat(600) + unsafeChars + 'more safe text';

      expect(largeTextWithUnsafe.length).toBeGreaterThan(5000);

      act(() =>
        result.current.handleInput({
          name: '',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: largeTextWithUnsafe,
        }),
      );

      const resultText = getBufferState(result).text;
      expect(resultText).not.toContain('\x07');
      expect(resultText).not.toContain('\x08');
      expect(resultText).not.toContain('\x0B');
      expect(resultText).not.toContain('\x0C');
      expect(resultText).toContain('safe text');
      expect(resultText).toContain('more safe text');
    }, 15_000);

    it('should sanitize large ANSI text (>5000 chars) and strip escape codes', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const largeTextWithAnsi =
        '\x1B[31m' +
        'red text'.repeat(800) +
        '\x1B[0m' +
        '\x1B[32m' +
        'green text'.repeat(200) +
        '\x1B[0m';

      expect(largeTextWithAnsi.length).toBeGreaterThan(5000);

      act(() =>
        result.current.handleInput({
          name: '',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: largeTextWithAnsi,
        }),
      );

      const resultText = getBufferState(result).text;
      expect(resultText).not.toContain('\x1B[31m');
      expect(resultText).not.toContain('\x1B[32m');
      expect(resultText).not.toContain('\x1B[0m');
      expect(resultText).toContain('red text');
      expect(resultText).toContain('green text');
    }, 15_000);

    it('should not strip popular emojis', () => {
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath: () => false }),
      );
      const emojis = '🐍🐳🦀🦄';
      act(() =>
        result.current.handleInput({
          name: '',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: emojis,
        }),
      );
      expect(getBufferState(result).text).toBe(emojis);
    });
  });

  describe('inputFilter', () => {
    it('should filter input based on the provided filter function', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          inputFilter: (text) => text.replace(/[^0-9]/g, ''),
        }),
      );

      act(() => result.current.insert('a1b2c3'));
      expect(getBufferState(result).text).toBe('123');
    });

    it('should handle empty result from filter', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          inputFilter: (text) => text.replace(/[^0-9]/g, ''),
        }),
      );

      act(() => result.current.insert('abc'));
      expect(getBufferState(result).text).toBe('');
    });

    it('should filter pasted text', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          inputFilter: (text) => text.toUpperCase(),
        }),
      );

      act(() => result.current.insert('hello', { paste: true }));
      expect(getBufferState(result).text).toBe('HELLO');
    });

    it('should not filter newlines if they are allowed by the filter', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          inputFilter: (text) => text, // Allow everything including newlines
        }),
      );

      act(() => result.current.insert('a\nb'));
      // The insert function splits by newline and inserts separately if it detects them.
      // If the filter allows them, they should be handled correctly by the subsequent logic in insert.
      expect(getBufferState(result).text).toBe('a\nb');
    });

    it('should filter before newline check in insert', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          inputFilter: (text) => text.replace(/\n/g, ''), // Filter out newlines
        }),
      );

      act(() => result.current.insert('a\nb'));
      expect(getBufferState(result).text).toBe('ab');
    });
  });

  describe('stripAnsi', () => {
    it('should correctly strip ANSI escape codes', () => {
      const textWithAnsi = '\x1B[31mHello\x1B[0m World';
      expect(stripAnsi(textWithAnsi)).toBe('Hello World');
    });

    it('should handle multiple ANSI codes', () => {
      const textWithMultipleAnsi = '\x1B[1m\x1B[34mBold Blue\x1B[0m Text';
      expect(stripAnsi(textWithMultipleAnsi)).toBe('Bold Blue Text');
    });

    it('should not modify text without ANSI codes', () => {
      const plainText = 'Plain text';
      expect(stripAnsi(plainText)).toBe('Plain text');
    });

    it('should handle empty string', () => {
      expect(stripAnsi('')).toBe('');
    });
  });

  describe('Memoization', () => {
    it('should keep action references stable across re-renders', () => {
      // We pass a stable `isValidPath` so that callbacks that depend on it
      // are not recreated on every render.
      const isValidPath = () => false;
      const { result, rerender } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath }),
      );

      const initialInsert = result.current.insert;
      const initialBackspace = result.current.backspace;
      const initialMove = result.current.move;
      const initialHandleInput = result.current.handleInput;

      rerender();

      expect(result.current.insert).toBe(initialInsert);
      expect(result.current.backspace).toBe(initialBackspace);
      expect(result.current.move).toBe(initialMove);
      expect(result.current.handleInput).toBe(initialHandleInput);
    });

    it('should have memoized actions that operate on the latest state', () => {
      const isValidPath = () => false;
      const { result } = renderHook(() =>
        useTextBuffer({ viewport, isValidPath }),
      );

      // Store a reference to the memoized insert function.
      const memoizedInsert = result.current.insert;

      // Update the buffer state.
      act(() => {
        result.current.insert('hello');
      });
      expect(getBufferState(result).text).toBe('hello');

      // Now, call the original memoized function reference.
      act(() => {
        memoizedInsert(' world');
      });

      // It should have operated on the updated state.
      expect(getBufferState(result).text).toBe('hello world');
    });
  });

  describe('singleLine mode', () => {
    it('should not insert a newline character when singleLine is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          singleLine: true,
        }),
      );
      act(() => result.current.insert('\n'));
      const state = getBufferState(result);
      expect(state.text).toBe('');
      expect(state.lines).toEqual(['']);
    });

    it('should not create a new line when newline() is called and singleLine is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'ab',
          viewport,
          isValidPath: () => false,
          singleLine: true,
        }),
      );
      act(() => result.current.move('end')); // cursor at [0,2]
      act(() => result.current.newline());
      const state = getBufferState(result);
      expect(state.text).toBe('ab');
      expect(state.lines).toEqual(['ab']);
      expect(state.cursor).toEqual([0, 2]);
    });

    it('should not handle "Enter" key as newline when singleLine is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          singleLine: true,
        }),
      );
      act(() =>
        result.current.handleInput({
          name: 'return',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: true,
          sequence: '\r',
        }),
      );
      expect(getBufferState(result).lines).toEqual(['']);
    });

    it('should not print anything for function keys when singleLine is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          singleLine: true,
        }),
      );
      act(() =>
        result.current.handleInput({
          name: 'f1',
          shift: false,
          alt: false,
          ctrl: false,
          cmd: false,
          insertable: false,
          sequence: '\u001bOP',
        }),
      );
      expect(getBufferState(result).lines).toEqual(['']);
    });

    it('should strip newlines from pasted text when singleLine is true', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          viewport,
          isValidPath: () => false,
          singleLine: true,
        }),
      );
      act(() => result.current.insert('hello\nworld', { paste: true }));
      const state = getBufferState(result);
      expect(state.text).toBe('helloworld');
      expect(state.lines).toEqual(['helloworld']);
    });
  });

  describe('Layout Caching and Invalidation', () => {
    it.each([
      {
        desc: 'via setText',
        actFn: (result: { current: TextBuffer }) =>
          result.current.setText('changed line'),
        expected: 'changed line',
      },
      {
        desc: 'via replaceRange',
        actFn: (result: { current: TextBuffer }) =>
          result.current.replaceRange(0, 0, 0, 13, 'changed line'),
        expected: 'changed line',
      },
    ])(
      'should invalidate cache when line content changes $desc',
      ({ actFn, expected }) => {
        const viewport = { width: 80, height: 24 };
        const { result } = renderHookWithProviders(() =>
          useTextBuffer({
            initialText: 'original line',
            viewport,
            isValidPath: () => true,
          }),
        );

        const originalLayout = result.current.visualLayout;

        act(() => {
          actFn(result);
        });

        expect(result.current.visualLayout).not.toBe(originalLayout);
        expect(result.current.allVisualLines[0]).toBe(expected);
      },
    );

    it('should invalidate cache when viewport width changes', () => {
      const viewport = { width: 80, height: 24 };
      const { result, rerender } = renderHookWithProviders(
        ({ vp }) =>
          useTextBuffer({
            initialText:
              'a very long line that will wrap when the viewport is small',
            viewport: vp,
            isValidPath: () => true,
          }),
        { initialProps: { vp: viewport } },
      );

      const originalLayout = result.current.visualLayout;

      // Shrink viewport to force wrapping change
      rerender({ vp: { width: 10, height: 24 } });

      expect(result.current.visualLayout).not.toBe(originalLayout);
      expect(result.current.allVisualLines.length).toBeGreaterThan(1);
    });

    it('should correctly handle cursor expansion/collapse in cached layout', () => {
      const viewport = { width: 80, height: 24 };
      const text = 'Check @image.png here';
      const { result } = renderHookWithProviders(() =>
        useTextBuffer({
          initialText: text,
          viewport,
          isValidPath: () => true,
        }),
      );

      // Cursor at start (collapsed)
      act(() => {
        result.current.moveToOffset(0);
      });
      expect(result.current.allVisualLines[0]).toContain('[Image image.png]');

      // Move cursor onto the @path (expanded)
      act(() => {
        result.current.moveToOffset(7); // onto @
      });
      expect(result.current.allVisualLines[0]).toContain('@image.png');
      expect(result.current.allVisualLines[0]).not.toContain(
        '[Image image.png]',
      );

      // Move cursor away (collapsed again)
      act(() => {
        result.current.moveToOffset(0);
      });
      expect(result.current.allVisualLines[0]).toContain('[Image image.png]');
    });

    it('should reuse cache for unchanged lines during editing', () => {
      const viewport = { width: 80, height: 24 };
      const initialText = 'line 1\nline 2\nline 3';
      const { result } = renderHookWithProviders(() =>
        useTextBuffer({
          initialText,
          viewport,
          isValidPath: () => true,
        }),
      );

      const layout1 = result.current.visualLayout;

      // Edit line 1
      act(() => {
        result.current.moveToOffset(0);
        result.current.insert('X');
      });

      const layout2 = result.current.visualLayout;
      expect(layout2).not.toBe(layout1);

      // Verify that visual lines for line 2 and 3 (indices 1 and 2 in visualLines)
      // are identical in content if not in object reference (the arrays are rebuilt, but contents are cached)
      expect(result.current.allVisualLines[1]).toBe('line 2');
      expect(result.current.allVisualLines[2]).toBe('line 3');
    });
  });

  describe('Scroll Regressions', () => {
    const scrollViewport: Viewport = { width: 80, height: 5 };

    it('should not show empty viewport when collapsing a large paste that was scrolled', () => {
      const largeContent =
        'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10';
      const placeholder = '[Pasted Text: 10 lines]';

      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: placeholder,
          viewport: scrollViewport,
          isValidPath: () => false,
        }),
      );

      // Setup: paste large content
      act(() => {
        result.current.setText('');
        result.current.insert(largeContent, { paste: true });
      });

      // Expand it
      act(() => {
        result.current.togglePasteExpansion(placeholder, 0, 0);
      });

      // Verify scrolled state
      expect(result.current.visualScrollRow).toBe(5);

      // Collapse it
      act(() => {
        result.current.togglePasteExpansion(placeholder, 9, 0);
      });

      // Verify viewport is NOT empty immediately (clamping in useMemo)
      expect(result.current.allVisualLines.length).toBe(1);
      expect(result.current.viewportVisualLines.length).toBe(1);
      expect(result.current.viewportVisualLines[0]).toBe(placeholder);
    });
  });
});
