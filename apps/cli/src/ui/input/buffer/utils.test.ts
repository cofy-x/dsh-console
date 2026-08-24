/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

import {
  offsetToLogicalPos,
  logicalPosToOffset,
  findWordEndInLine,
  findNextWordStartInLine,
  isWordCharStrict,
  calculateTransformationsForLine,
  calculateTransformedLine,
  getTransformUnderCursor,
  getTransformedImagePath,
} from './utils.js';
import { cpLen } from '../../../text/processing.js';
import type { Transformation } from './types.js';

describe('offsetToLogicalPos', () => {
  it.each([
    { text: 'any text', offset: 0, expected: [0, 0], desc: 'offset 0' },
    { text: 'hello', offset: 0, expected: [0, 0], desc: 'single line start' },
    { text: 'hello', offset: 2, expected: [0, 2], desc: 'single line middle' },
    { text: 'hello', offset: 5, expected: [0, 5], desc: 'single line end' },
    { text: 'hello', offset: 10, expected: [0, 5], desc: 'beyond end clamps' },
    {
      text: 'a\n\nc',
      offset: 0,
      expected: [0, 0],
      desc: 'empty lines - first char',
    },
    {
      text: 'a\n\nc',
      offset: 1,
      expected: [0, 1],
      desc: 'empty lines - end of first',
    },
    {
      text: 'a\n\nc',
      offset: 2,
      expected: [1, 0],
      desc: 'empty lines - empty line',
    },
    {
      text: 'a\n\nc',
      offset: 3,
      expected: [2, 0],
      desc: 'empty lines - last line start',
    },
    {
      text: 'a\n\nc',
      offset: 4,
      expected: [2, 1],
      desc: 'empty lines - last line end',
    },
    {
      text: 'hello\n',
      offset: 5,
      expected: [0, 5],
      desc: 'newline end - before newline',
    },
    {
      text: 'hello\n',
      offset: 6,
      expected: [1, 0],
      desc: 'newline end - after newline',
    },
    {
      text: 'hello\n',
      offset: 7,
      expected: [1, 0],
      desc: 'newline end - beyond',
    },
    {
      text: '\nhello',
      offset: 0,
      expected: [0, 0],
      desc: 'newline start - first line',
    },
    {
      text: '\nhello',
      offset: 1,
      expected: [1, 0],
      desc: 'newline start - second line',
    },
    {
      text: '\nhello',
      offset: 3,
      expected: [1, 2],
      desc: 'newline start - middle of second',
    },
    { text: '', offset: 0, expected: [0, 0], desc: 'empty string at 0' },
    { text: '', offset: 5, expected: [0, 0], desc: 'empty string beyond' },
    {
      text: '你好\n世界',
      offset: 0,
      expected: [0, 0],
      desc: 'unicode - start',
    },
    {
      text: '你好\n世界',
      offset: 1,
      expected: [0, 1],
      desc: 'unicode - after first char',
    },
    {
      text: '你好\n世界',
      offset: 2,
      expected: [0, 2],
      desc: 'unicode - end first line',
    },
    {
      text: '你好\n世界',
      offset: 3,
      expected: [1, 0],
      desc: 'unicode - second line start',
    },
    {
      text: '你好\n世界',
      offset: 4,
      expected: [1, 1],
      desc: 'unicode - second line middle',
    },
    {
      text: '你好\n世界',
      offset: 5,
      expected: [1, 2],
      desc: 'unicode - second line end',
    },
    {
      text: '你好\n世界',
      offset: 6,
      expected: [1, 2],
      desc: 'unicode - beyond',
    },
    {
      text: 'abc\ndef',
      offset: 3,
      expected: [0, 3],
      desc: 'at newline - end of line',
    },
    {
      text: 'abc\ndef',
      offset: 4,
      expected: [1, 0],
      desc: 'at newline - after newline',
    },
    { text: '🐶🐱', offset: 0, expected: [0, 0], desc: 'emoji - start' },
    { text: '🐶🐱', offset: 1, expected: [0, 1], desc: 'emoji - middle' },
    { text: '🐶🐱', offset: 2, expected: [0, 2], desc: 'emoji - end' },
  ])('should handle $desc', ({ text, offset, expected }) => {
    expect(offsetToLogicalPos(text, offset)).toEqual(expected);
  });

  describe('multi-line text', () => {
    const text = 'hello\nworld\n123';

    it.each([
      { offset: 0, expected: [0, 0], desc: 'start of first line' },
      { offset: 3, expected: [0, 3], desc: 'middle of first line' },
      { offset: 5, expected: [0, 5], desc: 'end of first line' },
      { offset: 6, expected: [1, 0], desc: 'start of second line' },
      { offset: 8, expected: [1, 2], desc: 'middle of second line' },
      { offset: 11, expected: [1, 5], desc: 'end of second line' },
      { offset: 12, expected: [2, 0], desc: 'start of third line' },
      { offset: 13, expected: [2, 1], desc: 'middle of third line' },
      { offset: 15, expected: [2, 3], desc: 'end of third line' },
      { offset: 20, expected: [2, 3], desc: 'beyond end' },
    ])(
      'should return $expected for $desc (offset $offset)',
      ({ offset, expected }) => {
        expect(offsetToLogicalPos(text, offset)).toEqual(expected);
      },
    );
  });
});

describe('logicalPosToOffset', () => {
  it('should convert row/col position to offset correctly', () => {
    const lines = ['hello', 'world', '123'];

    // Line 0: "hello" (5 chars)
    expect(logicalPosToOffset(lines, 0, 0)).toBe(0); // Start of 'hello'
    expect(logicalPosToOffset(lines, 0, 3)).toBe(3); // 'l' in 'hello'
    expect(logicalPosToOffset(lines, 0, 5)).toBe(5); // End of 'hello'

    // Line 1: "world" (5 chars), offset starts at 6 (5 + 1 for newline)
    expect(logicalPosToOffset(lines, 1, 0)).toBe(6); // Start of 'world'
    expect(logicalPosToOffset(lines, 1, 2)).toBe(8); // 'r' in 'world'
    expect(logicalPosToOffset(lines, 1, 5)).toBe(11); // End of 'world'

    // Line 2: "123" (3 chars), offset starts at 12 (5 + 1 + 5 + 1)
    expect(logicalPosToOffset(lines, 2, 0)).toBe(12); // Start of '123'
    expect(logicalPosToOffset(lines, 2, 1)).toBe(13); // '2' in '123'
    expect(logicalPosToOffset(lines, 2, 3)).toBe(15); // End of '123'
  });

  it('should handle empty lines', () => {
    const lines = ['a', '', 'c'];

    expect(logicalPosToOffset(lines, 0, 0)).toBe(0); // 'a'
    expect(logicalPosToOffset(lines, 0, 1)).toBe(1); // End of 'a'
    expect(logicalPosToOffset(lines, 1, 0)).toBe(2); // Empty line
    expect(logicalPosToOffset(lines, 2, 0)).toBe(3); // 'c'
    expect(logicalPosToOffset(lines, 2, 1)).toBe(4); // End of 'c'
  });

  it('should handle single empty line', () => {
    const lines = [''];

    expect(logicalPosToOffset(lines, 0, 0)).toBe(0);
  });

  it('should be inverse of offsetToLogicalPos', () => {
    const lines = ['hello', 'world', '123'];
    const text = lines.join('\n');

    // Test round-trip conversion
    for (let offset = 0; offset <= text.length; offset++) {
      const [row, col] = offsetToLogicalPos(text, offset);
      const convertedOffset = logicalPosToOffset(lines, row, col);
      expect(convertedOffset).toBe(offset);
    }
  });

  it('should handle out-of-bounds positions', () => {
    const lines = ['hello'];

    // Beyond end of line
    expect(logicalPosToOffset(lines, 0, 10)).toBe(5); // Clamps to end of line

    // Beyond array bounds - should clamp to the last line
    expect(logicalPosToOffset(lines, 5, 0)).toBe(0); // Clamps to start of last line (row 0)
    expect(logicalPosToOffset(lines, 5, 10)).toBe(5); // Clamps to end of last line
  });
});

describe('Unicode helper functions', () => {
  describe('findWordEndInLine with Unicode', () => {
    it('should handle combining characters', () => {
      // café with combining accent
      const cafeWithCombining = 'cafe\u0301';
      const result = findWordEndInLine(cafeWithCombining + ' test', 0);
      expect(result).toBe(3); // End of 'café' at base character 'e', not combining accent
    });

    it('should handle precomposed characters with diacritics', () => {
      // café with precomposed é (U+00E9)
      const cafePrecomposed = 'café';
      const result = findWordEndInLine(cafePrecomposed + ' test', 0);
      expect(result).toBe(3); // End of 'café' at precomposed character 'é'
    });

    it('should return null when no word end found', () => {
      const result = findWordEndInLine('   ', 0);
      expect(result).toBeNull(); // No word end found in whitespace-only string string
    });
  });

  describe('findNextWordStartInLine with Unicode', () => {
    it('should handle right-to-left text', () => {
      const result = findNextWordStartInLine('hello مرحبا world', 0);
      expect(result).toBe(6); // Start of Arabic word
    });

    it('should handle Chinese characters', () => {
      const result = findNextWordStartInLine('hello 你好 world', 0);
      expect(result).toBe(6); // Start of Chinese word
    });

    it('should return null at end of line', () => {
      const result = findNextWordStartInLine('hello', 10);
      expect(result).toBeNull();
    });

    it('should handle combining characters', () => {
      // café with combining accent + next word
      const textWithCombining = 'cafe\u0301 test';
      const result = findNextWordStartInLine(textWithCombining, 0);
      expect(result).toBe(6); // Start of 'test' after 'café ' (combining char makes string longer)
    });

    it('should handle precomposed characters with diacritics', () => {
      // café with precomposed é + next word
      const textPrecomposed = 'café test';
      const result = findNextWordStartInLine(textPrecomposed, 0);
      expect(result).toBe(5); // Start of 'test' after 'café '
    });
  });

  describe('isWordCharStrict with Unicode', () => {
    it('should return true for ASCII word characters', () => {
      expect(isWordCharStrict('a')).toBe(true);
      expect(isWordCharStrict('Z')).toBe(true);
      expect(isWordCharStrict('0')).toBe(true);
      expect(isWordCharStrict('_')).toBe(true);
    });

    it('should return false for punctuation', () => {
      expect(isWordCharStrict('.')).toBe(false);
      expect(isWordCharStrict(',')).toBe(false);
      expect(isWordCharStrict('!')).toBe(false);
    });

    it('should return true for non-Latin scripts', () => {
      expect(isWordCharStrict('你')).toBe(true); // Chinese character
      expect(isWordCharStrict('م')).toBe(true); // Arabic character
    });

    it('should return false for whitespace', () => {
      expect(isWordCharStrict(' ')).toBe(false);
      expect(isWordCharStrict('\t')).toBe(false);
    });
  });

  describe('cpLen with Unicode', () => {
    it('should handle combining characters', () => {
      expect(cpLen('é')).toBe(1); // Precomposed
      expect(cpLen('e\u0301')).toBe(2); // e + combining acute
    });

    it('should handle Chinese and Arabic text', () => {
      expect(cpLen('hello 你好 world')).toBe(14); // 5 + 1 + 2 + 1 + 5 = 14
      expect(cpLen('hello مرحبا world')).toBe(17);
    });
  });
});

describe('Transformation Utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTransformedImagePath', () => {
    it('should transform a simple image path', () => {
      expect(getTransformedImagePath('@test.png')).toBe('[Image test.png]');
    });

    it('should handle paths with directories', () => {
      expect(getTransformedImagePath('@path/to/image.jpg')).toBe(
        '[Image image.jpg]',
      );
    });

    it('should truncate long filenames', () => {
      expect(getTransformedImagePath('@verylongfilename1234567890.png')).toBe(
        '[Image ...1234567890.png]',
      );
    });

    it('should handle different image extensions', () => {
      expect(getTransformedImagePath('@test.jpg')).toBe('[Image test.jpg]');
      expect(getTransformedImagePath('@test.jpeg')).toBe('[Image test.jpeg]');
      expect(getTransformedImagePath('@test.gif')).toBe('[Image test.gif]');
      expect(getTransformedImagePath('@test.webp')).toBe('[Image test.webp]');
      expect(getTransformedImagePath('@test.svg')).toBe('[Image test.svg]');
      expect(getTransformedImagePath('@test.bmp')).toBe('[Image test.bmp]');
    });

    it('should handle POSIX-style forward-slash paths on any platform', () => {
      const input = '@C:/Users/foo/screenshots/image2x.png';
      expect(getTransformedImagePath(input)).toBe('[Image image2x.png]');
    });

    it('should handle Windows-style backslash paths on any platform', () => {
      const input = '@C:\\Users\\foo\\screenshots\\image2x.png';
      expect(getTransformedImagePath(input)).toBe('[Image image2x.png]');
    });

    it('should handle escaped spaces in paths', () => {
      const input = '@path/to/my\\ file.png';
      expect(getTransformedImagePath(input)).toBe('[Image my file.png]');
    });
  });

  describe('getTransformationsForLine', () => {
    it('should find transformations in a line', () => {
      const line = 'Check out @test.png and @another.jpg';
      const result = calculateTransformationsForLine(line);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        logicalText: '@test.png',
        collapsedText: '[Image test.png]',
      });
      expect(result[1]).toMatchObject({
        logicalText: '@another.jpg',
        collapsedText: '[Image another.jpg]',
      });
    });

    it('should handle no transformations', () => {
      const line = 'Just some regular text';
      const result = calculateTransformationsForLine(line);
      expect(result).toEqual([]);
    });

    it('should handle empty line', () => {
      const result = calculateTransformationsForLine('');
      expect(result).toEqual([]);
    });

    it('should keep adjacent image paths as separate transformations', () => {
      const line = '@a.png@b.png@c.png';
      const result = calculateTransformationsForLine(line);
      expect(result).toHaveLength(3);
      expect(result[0].logicalText).toBe('@a.png');
      expect(result[1].logicalText).toBe('@b.png');
      expect(result[2].logicalText).toBe('@c.png');
    });

    it('should handle multiple transformations in a row', () => {
      const line = '@a.png @b.png @c.png';
      const result = calculateTransformationsForLine(line);
      expect(result).toHaveLength(3);
    });
  });

  describe('getTransformUnderCursor', () => {
    const transformations: Transformation[] = [
      {
        logStart: 5,
        logEnd: 14,
        logicalText: '@test.png',
        collapsedText: '[Image @test.png]',
        type: 'image',
      },
      {
        logStart: 20,
        logEnd: 31,
        logicalText: '@another.jpg',
        collapsedText: '[Image @another.jpg]',
        type: 'image',
      },
    ];

    it('should find transformation when cursor is inside it', () => {
      const result = getTransformUnderCursor(0, 7, [transformations]);
      expect(result).toEqual(transformations[0]);
    });

    it('should find transformation when cursor is at start', () => {
      const result = getTransformUnderCursor(0, 5, [transformations]);
      expect(result).toEqual(transformations[0]);
    });

    it('should NOT find transformation when cursor is at end', () => {
      const result = getTransformUnderCursor(0, 14, [transformations]);
      expect(result).toBeNull();
    });

    it('should return null when cursor is not on a transformation', () => {
      const result = getTransformUnderCursor(0, 2, [transformations]);
      expect(result).toBeNull();
    });

    it('should handle empty transformations array', () => {
      const result = getTransformUnderCursor(0, 5, []);
      expect(result).toBeNull();
    });

    it('regression: should not find paste transformation when clicking one character after it', () => {
      const pasteId = '[Pasted Text: 5 lines]';
      const line = pasteId + ' suffix';
      const transformations = calculateTransformationsForLine(line);
      const pasteTransform = transformations.find((t) => t.type === 'paste');
      expect(pasteTransform).toBeDefined();

      const endPos = pasteTransform!.logEnd;
      // Position strictly at end should be null
      expect(getTransformUnderCursor(0, endPos, [transformations])).toBeNull();
      // Position inside should be found
      expect(getTransformUnderCursor(0, endPos - 1, [transformations])).toEqual(
        pasteTransform,
      );
    });
  });

  describe('calculateTransformedLine', () => {
    it('should transform a line with one transformation', () => {
      const line = 'Check out @test.png';
      const transformations = calculateTransformationsForLine(line);
      const result = calculateTransformedLine(line, 0, [0, 0], transformations);

      expect(result.transformedLine).toBe('Check out [Image test.png]');
      expect(result.transformedToLogMap).toHaveLength(27); // Length includes all characters in the transformed line

      // Test that we have proper mappings
      expect(result.transformedToLogMap[0]).toBe(0); // 'C'
      expect(result.transformedToLogMap[9]).toBe(9); // ' ' before transformation
    });

    it('should handle cursor inside transformation', () => {
      const line = 'Check out @test.png';
      const transformations = calculateTransformationsForLine(line);
      // Cursor at '@' (position 10 in the line)
      const result = calculateTransformedLine(
        line,
        0,
        [0, 10],
        transformations,
      );

      // Should show full path when cursor is on it
      expect(result.transformedLine).toBe('Check out @test.png');
      // When expanded, each character maps to itself
      expect(result.transformedToLogMap[10]).toBe(10); // '@'
    });

    it('should handle line with no transformations', () => {
      const line = 'Just some text';
      const result = calculateTransformedLine(line, 0, [0, 0], []);

      expect(result.transformedLine).toBe(line);
      // Each visual position should map directly to logical position + trailing
      expect(result.transformedToLogMap).toHaveLength(15); // 14 chars + 1 trailing
      expect(result.transformedToLogMap[0]).toBe(0);
      expect(result.transformedToLogMap[13]).toBe(13);
      expect(result.transformedToLogMap[14]).toBe(14); // Trailing position
    });

    it('should handle empty line', () => {
      const result = calculateTransformedLine('', 0, [0, 0], []);
      expect(result.transformedLine).toBe('');
      expect(result.transformedToLogMap).toEqual([0]); // Just the trailing position
    });
  });
});
