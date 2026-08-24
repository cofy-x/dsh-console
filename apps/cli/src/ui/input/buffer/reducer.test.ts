/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import type {
  TextBufferState,
  TextBufferAction,
  TextBufferOptions,
  VisualLayout,
} from './types.js';
import { textBufferReducer } from './reducer.js';
import { calculateTransformationsForLine } from './utils.js';

const defaultVisualLayout: VisualLayout = {
  visualLines: [''],
  logicalToVisualMap: [[[0, 0]]],
  visualToLogicalMap: [[0, 0]],
  transformedToLogicalMaps: [[]],
  visualToTransformedMap: [],
};

const initialState: TextBufferState = {
  lines: [''],
  cursorRow: 0,
  cursorCol: 0,
  preferredCol: null,
  undoStack: [],
  redoStack: [],
  clipboard: null,
  selectionAnchor: null,
  viewportWidth: 80,
  viewportHeight: 24,
  transformationsByLine: [[]],
  visualLayout: defaultVisualLayout,
  pastedContent: {},
  expandedPaste: null,
};

/**
 * Helper to create a TextBufferState with properly calculated transformations.
 */
function createStateWithTransformations(
  partial: Partial<TextBufferState>,
): TextBufferState {
  const state = { ...initialState, ...partial };
  return {
    ...state,
    transformationsByLine: state.lines.map((l) =>
      calculateTransformationsForLine(l),
    ),
  };
}

describe('textBufferReducer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the initial state if state is undefined', () => {
    const action = { type: 'unknown_action' } as unknown as TextBufferAction;
    const state = textBufferReducer(initialState, action);
    expect(state).toHaveOnlyValidCharacters();
    expect(state).toEqual(initialState);
  });

  describe('set_text action', () => {
    it('should set new text and move cursor to the end', () => {
      const action: TextBufferAction = {
        type: 'set_text',
        payload: 'hello\nworld',
      };
      const state = textBufferReducer(initialState, action);
      expect(state).toHaveOnlyValidCharacters();
      expect(state.lines).toEqual(['hello', 'world']);
      expect(state.cursorRow).toBe(1);
      expect(state.cursorCol).toBe(5);
      expect(state.undoStack.length).toBe(1);
    });

    it('should not create an undo snapshot if pushToUndo is false', () => {
      const action: TextBufferAction = {
        type: 'set_text',
        payload: 'no undo',
        pushToUndo: false,
      };
      const state = textBufferReducer(initialState, action);
      expect(state).toHaveOnlyValidCharacters();
      expect(state.lines).toEqual(['no undo']);
      expect(state.undoStack.length).toBe(0);
    });
  });

  describe('insert action', () => {
    it('should insert a character', () => {
      const action: TextBufferAction = { type: 'insert', payload: 'a' };
      const state = textBufferReducer(initialState, action);
      expect(state).toHaveOnlyValidCharacters();
      expect(state.lines).toEqual(['a']);
      expect(state.cursorCol).toBe(1);
    });

    it('should insert a newline', () => {
      const stateWithText = { ...initialState, lines: ['hello'] };
      const action: TextBufferAction = { type: 'insert', payload: '\n' };
      const state = textBufferReducer(stateWithText, action);
      expect(state).toHaveOnlyValidCharacters();
      expect(state.lines).toEqual(['', 'hello']);
      expect(state.cursorRow).toBe(1);
      expect(state.cursorCol).toBe(0);
    });

    it('should create a distinct placeholder for repeated large pastes', () => {
      const content = 'x'.repeat(501);
      const existingId = '[Pasted Text: 501 chars]';
      const action: TextBufferAction = {
        type: 'insert',
        payload: content,
        isPaste: true,
      };

      const state = textBufferReducer(
        {
          ...initialState,
          pastedContent: { [existingId]: content },
        },
        action,
      );

      const nextId = '[Pasted Text: 501 chars #2]';
      expect(state.lines).toEqual([nextId]);
      expect(state.pastedContent).toEqual({
        [existingId]: content,
        [nextId]: content,
      });
    });
  });

  describe('insert action with options', () => {
    it('should filter input using inputFilter option', () => {
      const action: TextBufferAction = { type: 'insert', payload: 'a1b2c3' };
      const options: TextBufferOptions = {
        inputFilter: (text) => text.replace(/[0-9]/g, ''),
      };
      const state = textBufferReducer(initialState, action, options);
      expect(state.lines).toEqual(['abc']);
      expect(state.cursorCol).toBe(3);
    });

    it('should strip newlines when singleLine option is true', () => {
      const action: TextBufferAction = {
        type: 'insert',
        payload: 'hello\nworld',
      };
      const options: TextBufferOptions = { singleLine: true };
      const state = textBufferReducer(initialState, action, options);
      expect(state.lines).toEqual(['helloworld']);
      expect(state.cursorCol).toBe(10);
    });

    it('should apply both inputFilter and singleLine options', () => {
      const action: TextBufferAction = {
        type: 'insert',
        payload: 'h\ne\nl\nl\no\n1\n2\n3',
      };
      const options: TextBufferOptions = {
        singleLine: true,
        inputFilter: (text) => text.replace(/[0-9]/g, ''),
      };
      const state = textBufferReducer(initialState, action, options);
      expect(state.lines).toEqual(['hello']);
      expect(state.cursorCol).toBe(5);
    });
  });

  describe('add_pasted_content action', () => {
    it('should add content to pastedContent Record', () => {
      const action: TextBufferAction = {
        type: 'add_pasted_content',
        payload: { id: '[Pasted Text: 6 lines]', text: 'large content' },
      };
      const state = textBufferReducer(initialState, action);
      expect(state.pastedContent).toEqual({
        '[Pasted Text: 6 lines]': 'large content',
      });
    });
  });

  describe('backspace action', () => {
    it('should remove a character', () => {
      const stateWithText: TextBufferState = {
        ...initialState,
        lines: ['a'],
        cursorRow: 0,
        cursorCol: 1,
      };
      const action: TextBufferAction = { type: 'backspace' };
      const state = textBufferReducer(stateWithText, action);
      expect(state).toHaveOnlyValidCharacters();
      expect(state.lines).toEqual(['']);
      expect(state.cursorCol).toBe(0);
    });

    it('should join lines if at the beginning of a line', () => {
      const stateWithText: TextBufferState = {
        ...initialState,
        lines: ['hello', 'world'],
        cursorRow: 1,
        cursorCol: 0,
      };
      const action: TextBufferAction = { type: 'backspace' };
      const state = textBufferReducer(stateWithText, action);
      expect(state).toHaveOnlyValidCharacters();
      expect(state.lines).toEqual(['helloworld']);
      expect(state.cursorRow).toBe(0);
      expect(state.cursorCol).toBe(5);
    });
  });

  describe('atomic placeholder deletion', () => {
    describe('paste placeholders', () => {
      it('backspace at end of paste placeholder removes entire placeholder', () => {
        const placeholder = '[Pasted Text: 6 lines]';
        const stateWithPlaceholder = createStateWithTransformations({
          lines: [placeholder],
          cursorRow: 0,
          cursorCol: placeholder.length, // cursor at end
          pastedContent: {
            [placeholder]: 'line1\nline2\nline3\nline4\nline5\nline6',
          },
        });
        const action: TextBufferAction = { type: 'backspace' };
        const state = textBufferReducer(stateWithPlaceholder, action);
        expect(state).toHaveOnlyValidCharacters();
        expect(state.lines).toEqual(['']);
        expect(state.cursorCol).toBe(0);
        // pastedContent should be cleaned up
        expect(state.pastedContent[placeholder]).toBeUndefined();
      });

      it('delete at start of paste placeholder removes entire placeholder', () => {
        const placeholder = '[Pasted Text: 6 lines]';
        const stateWithPlaceholder = createStateWithTransformations({
          lines: [placeholder],
          cursorRow: 0,
          cursorCol: 0, // cursor at start
          pastedContent: {
            [placeholder]: 'line1\nline2\nline3\nline4\nline5\nline6',
          },
        });
        const action: TextBufferAction = { type: 'delete' };
        const state = textBufferReducer(stateWithPlaceholder, action);
        expect(state).toHaveOnlyValidCharacters();
        expect(state.lines).toEqual(['']);
        expect(state.cursorCol).toBe(0);
        // pastedContent should be cleaned up
        expect(state.pastedContent[placeholder]).toBeUndefined();
      });

      it('backspace inside paste placeholder does normal deletion', () => {
        const placeholder = '[Pasted Text: 6 lines]';
        const stateWithPlaceholder = createStateWithTransformations({
          lines: [placeholder],
          cursorRow: 0,
          cursorCol: 10, // cursor in middle
          pastedContent: {
            [placeholder]: 'line1\nline2\nline3\nline4\nline5\nline6',
          },
        });
        const action: TextBufferAction = { type: 'backspace' };
        const state = textBufferReducer(stateWithPlaceholder, action);
        expect(state).toHaveOnlyValidCharacters();
        // Should only delete one character
        expect(state.lines[0].length).toBe(placeholder.length - 1);
        expect(state.cursorCol).toBe(9);
        // pastedContent should NOT be cleaned up (placeholder is broken)
        expect(state.pastedContent[placeholder]).toBeDefined();
      });
    });

    describe('image placeholders', () => {
      it('backspace at end of image path removes entire path', () => {
        const imagePath = '@test.png';
        const stateWithImage = createStateWithTransformations({
          lines: [imagePath],
          cursorRow: 0,
          cursorCol: imagePath.length, // cursor at end
        });
        const action: TextBufferAction = { type: 'backspace' };
        const state = textBufferReducer(stateWithImage, action);
        expect(state).toHaveOnlyValidCharacters();
        expect(state.lines).toEqual(['']);
        expect(state.cursorCol).toBe(0);
      });

      it('delete at start of image path removes entire path', () => {
        const imagePath = '@test.png';
        const stateWithImage = createStateWithTransformations({
          lines: [imagePath],
          cursorRow: 0,
          cursorCol: 0, // cursor at start
        });
        const action: TextBufferAction = { type: 'delete' };
        const state = textBufferReducer(stateWithImage, action);
        expect(state).toHaveOnlyValidCharacters();
        expect(state.lines).toEqual(['']);
        expect(state.cursorCol).toBe(0);
      });

      it('backspace inside image path does normal deletion', () => {
        const imagePath = '@test.png';
        const stateWithImage = createStateWithTransformations({
          lines: [imagePath],
          cursorRow: 0,
          cursorCol: 5, // cursor in middle
        });
        const action: TextBufferAction = { type: 'backspace' };
        const state = textBufferReducer(stateWithImage, action);
        expect(state).toHaveOnlyValidCharacters();
        // Should only delete one character
        expect(state.lines[0].length).toBe(imagePath.length - 1);
        expect(state.cursorCol).toBe(4);
      });
    });

    describe('undo behavior', () => {
      it('undo after placeholder deletion restores everything', () => {
        const placeholder = '[Pasted Text: 6 lines]';
        const pasteContent = 'line1\nline2\nline3\nline4\nline5\nline6';
        const stateWithPlaceholder = createStateWithTransformations({
          lines: [placeholder],
          cursorRow: 0,
          cursorCol: placeholder.length,
          pastedContent: { [placeholder]: pasteContent },
        });

        // Delete the placeholder
        const deleteAction: TextBufferAction = { type: 'backspace' };
        const stateAfterDelete = textBufferReducer(
          stateWithPlaceholder,
          deleteAction,
        );
        expect(stateAfterDelete.lines).toEqual(['']);
        expect(stateAfterDelete.pastedContent[placeholder]).toBeUndefined();

        // Undo should restore
        const undoAction: TextBufferAction = { type: 'undo' };
        const stateAfterUndo = textBufferReducer(stateAfterDelete, undoAction);
        expect(stateAfterUndo).toHaveOnlyValidCharacters();
        expect(stateAfterUndo.lines).toEqual([placeholder]);
        expect(stateAfterUndo.pastedContent[placeholder]).toBe(pasteContent);
      });
    });
  });

  describe('undo/redo actions', () => {
    it('should undo and redo a change', () => {
      // 1. Insert text
      const insertAction: TextBufferAction = {
        type: 'insert',
        payload: 'test',
      };
      const stateAfterInsert = textBufferReducer(initialState, insertAction);
      expect(stateAfterInsert).toHaveOnlyValidCharacters();
      expect(stateAfterInsert.lines).toEqual(['test']);
      expect(stateAfterInsert.undoStack.length).toBe(1);

      // 2. Undo
      const undoAction: TextBufferAction = { type: 'undo' };
      const stateAfterUndo = textBufferReducer(stateAfterInsert, undoAction);
      expect(stateAfterUndo).toHaveOnlyValidCharacters();
      expect(stateAfterUndo.lines).toEqual(['']);
      expect(stateAfterUndo.undoStack.length).toBe(0);
      expect(stateAfterUndo.redoStack.length).toBe(1);

      // 3. Redo
      const redoAction: TextBufferAction = { type: 'redo' };
      const stateAfterRedo = textBufferReducer(stateAfterUndo, redoAction);
      expect(stateAfterRedo).toHaveOnlyValidCharacters();
      expect(stateAfterRedo.lines).toEqual(['test']);
      expect(stateAfterRedo.undoStack.length).toBe(1);
      expect(stateAfterRedo.redoStack.length).toBe(0);
    });
  });

  describe('create_undo_snapshot action', () => {
    it('should create a snapshot without changing state', () => {
      const stateWithText: TextBufferState = {
        ...initialState,
        lines: ['hello'],
        cursorRow: 0,
        cursorCol: 5,
      };
      const action: TextBufferAction = { type: 'create_undo_snapshot' };
      const state = textBufferReducer(stateWithText, action);
      expect(state).toHaveOnlyValidCharacters();

      expect(state.lines).toEqual(['hello']);
      expect(state.cursorRow).toBe(0);
      expect(state.cursorCol).toBe(5);
      expect(state.undoStack.length).toBe(1);
      expect(state.undoStack[0].lines).toEqual(['hello']);
      expect(state.undoStack[0].cursorRow).toBe(0);
      expect(state.undoStack[0].cursorCol).toBe(5);
    });
  });

  describe('delete_word_left action', () => {
    const createSingleLineState = (
      text: string,
      col: number,
    ): TextBufferState => ({
      ...initialState,
      lines: [text],
      cursorRow: 0,
      cursorCol: col,
    });

    it.each([
      {
        input: 'hello world',
        cursorCol: 11,
        expectedLines: ['hello '],
        expectedCol: 6,
        desc: 'simple word',
      },
      {
        input: 'path/to/file',
        cursorCol: 12,
        expectedLines: ['path/to/'],
        expectedCol: 8,
        desc: 'path segment',
      },
      {
        input: 'variable_name',
        cursorCol: 13,
        expectedLines: ['variable_'],
        expectedCol: 9,
        desc: 'variable_name parts',
      },
    ])(
      'should delete $desc',
      ({ input, cursorCol, expectedLines, expectedCol }) => {
        const state = textBufferReducer(
          createSingleLineState(input, cursorCol),
          { type: 'delete_word_left' },
        );
        expect(state.lines).toEqual(expectedLines);
        expect(state.cursorCol).toBe(expectedCol);
      },
    );

    it('should act like backspace at the beginning of a line', () => {
      const stateWithText: TextBufferState = {
        ...initialState,
        lines: ['hello', 'world'],
        cursorRow: 1,
        cursorCol: 0,
      };
      const state = textBufferReducer(stateWithText, {
        type: 'delete_word_left',
      });
      expect(state.lines).toEqual(['helloworld']);
      expect(state.cursorRow).toBe(0);
      expect(state.cursorCol).toBe(5);
    });
  });

  describe('delete_word_right action', () => {
    const createSingleLineState = (
      text: string,
      col: number,
    ): TextBufferState => ({
      ...initialState,
      lines: [text],
      cursorRow: 0,
      cursorCol: col,
    });

    it.each([
      {
        input: 'hello world',
        cursorCol: 0,
        expectedLines: ['world'],
        expectedCol: 0,
        desc: 'simple word',
      },
      {
        input: 'variable_name',
        cursorCol: 0,
        expectedLines: ['_name'],
        expectedCol: 0,
        desc: 'variable_name parts',
      },
    ])(
      'should delete $desc',
      ({ input, cursorCol, expectedLines, expectedCol }) => {
        const state = textBufferReducer(
          createSingleLineState(input, cursorCol),
          { type: 'delete_word_right' },
        );
        expect(state.lines).toEqual(expectedLines);
        expect(state.cursorCol).toBe(expectedCol);
      },
    );

    it('should delete path segments progressively', () => {
      const stateWithText: TextBufferState = {
        ...initialState,
        lines: ['path/to/file'],
        cursorRow: 0,
        cursorCol: 0,
      };
      let state = textBufferReducer(stateWithText, {
        type: 'delete_word_right',
      });
      expect(state.lines).toEqual(['/to/file']);
      state = textBufferReducer(state, { type: 'delete_word_right' });
      expect(state.lines).toEqual(['to/file']);
    });

    it('should act like delete at the end of a line', () => {
      const stateWithText: TextBufferState = {
        ...initialState,
        lines: ['hello', 'world'],
        cursorRow: 0,
        cursorCol: 5,
      };
      const state = textBufferReducer(stateWithText, {
        type: 'delete_word_right',
      });
      expect(state.lines).toEqual(['helloworld']);
      expect(state.cursorRow).toBe(0);
      expect(state.cursorCol).toBe(5);
    });
  });

  describe('toggle_paste_expansion action', () => {
    const placeholder = '[Pasted Text: 6 lines]';
    const content = 'line1\nline2\nline3\nline4\nline5\nline6';

    it('should expand a placeholder correctly', () => {
      const stateWithPlaceholder = createStateWithTransformations({
        lines: ['prefix ' + placeholder + ' suffix'],
        cursorRow: 0,
        cursorCol: 0,
        pastedContent: { [placeholder]: content },
      });

      const action: TextBufferAction = {
        type: 'toggle_paste_expansion',
        payload: { id: placeholder, row: 0, col: 7 },
      };

      const state = textBufferReducer(stateWithPlaceholder, action);

      expect(state.lines).toEqual([
        'prefix line1',
        'line2',
        'line3',
        'line4',
        'line5',
        'line6 suffix',
      ]);
      expect(state.expandedPaste?.id).toBe(placeholder);
      const info = state.expandedPaste;
      expect(info).toEqual({
        id: placeholder,
        startLine: 0,
        lineCount: 6,
        prefix: 'prefix ',
        suffix: ' suffix',
      });
      // Cursor should be at the end of expanded content (before suffix)
      expect(state.cursorRow).toBe(5);
      expect(state.cursorCol).toBe(5); // length of 'line6'
    });

    it('should collapse an expanded placeholder correctly', () => {
      const expandedState = createStateWithTransformations({
        lines: [
          'prefix line1',
          'line2',
          'line3',
          'line4',
          'line5',
          'line6 suffix',
        ],
        cursorRow: 5,
        cursorCol: 5,
        pastedContent: { [placeholder]: content },
        expandedPaste: {
          id: placeholder,
          startLine: 0,
          lineCount: 6,
          prefix: 'prefix ',
          suffix: ' suffix',
        },
      });

      const action: TextBufferAction = {
        type: 'toggle_paste_expansion',
        payload: { id: placeholder, row: 0, col: 7 },
      };

      const state = textBufferReducer(expandedState, action);

      expect(state.lines).toEqual(['prefix ' + placeholder + ' suffix']);
      expect(state.expandedPaste).toBeNull();
      // Cursor should be at the end of the collapsed placeholder
      expect(state.cursorRow).toBe(0);
      expect(state.cursorCol).toBe(('prefix ' + placeholder).length);
    });

    it('should expand single-line content correctly', () => {
      const singleLinePlaceholder = '[Pasted Text: 10 chars]';
      const singleLineContent = 'some text';
      const stateWithPlaceholder = createStateWithTransformations({
        lines: [singleLinePlaceholder],
        cursorRow: 0,
        cursorCol: 0,
        pastedContent: { [singleLinePlaceholder]: singleLineContent },
      });

      const state = textBufferReducer(stateWithPlaceholder, {
        type: 'toggle_paste_expansion',
        payload: { id: singleLinePlaceholder, row: 0, col: 0 },
      });

      expect(state.lines).toEqual(['some text']);
      expect(state.cursorRow).toBe(0);
      expect(state.cursorCol).toBe(9);
    });

    it('should return current state if placeholder ID not found in pastedContent', () => {
      const action: TextBufferAction = {
        type: 'toggle_paste_expansion',
        payload: { id: 'unknown', row: 0, col: 0 },
      };
      const state = textBufferReducer(initialState, action);
      expect(state).toBe(initialState);
    });

    it('should preserve expandedPaste when lines change from edits outside the region', () => {
      // Start with an expanded paste at line 0 (3 lines long)
      const placeholder = '[Pasted Text: 3 lines]';
      const expandedState = createStateWithTransformations({
        lines: ['line1', 'line2', 'line3', 'suffix'],
        cursorRow: 3,
        cursorCol: 0,
        pastedContent: { [placeholder]: 'line1\nline2\nline3' },
        expandedPaste: {
          id: placeholder,
          startLine: 0,
          lineCount: 3,
          prefix: '',
          suffix: '',
        },
      });

      expect(expandedState.expandedPaste).not.toBeNull();

      // Insert a newline at the end - this changes lines but is OUTSIDE the expanded region
      const stateAfterInsert = textBufferReducer(expandedState, {
        type: 'insert',
        payload: '\n',
      });

      // Lines changed, but expandedPaste should be PRESERVED and optionally shifted (no shift here since edit is after)
      expect(stateAfterInsert.expandedPaste).not.toBeNull();
      expect(stateAfterInsert.expandedPaste?.id).toBe(placeholder);
    });
  });
});

const createTestState = (
  lines: string[],
  cursorRow: number,
  cursorCol: number,
  viewportWidth = 80,
): TextBufferState => {
  const text = lines.join('\n');
  let state = textBufferReducer(initialState, {
    type: 'set_text',
    payload: text,
  });
  state = textBufferReducer(state, {
    type: 'set_cursor',
    payload: { cursorRow, cursorCol, preferredCol: null },
  });
  state = textBufferReducer(state, {
    type: 'set_viewport',
    payload: { width: viewportWidth, height: 24 },
  });
  return state;
};

describe('textBufferReducer vim operations', () => {
  describe('vim_delete_line', () => {
    it('should delete a single line including newline in multi-line text', () => {
      const state = createTestState(['line1', 'line2', 'line3'], 1, 2);

      const action: TextBufferAction = {
        type: 'vim_delete_line',
        payload: { count: 1 },
      };

      const result = textBufferReducer(state, action);
      expect(result).toHaveOnlyValidCharacters();

      // After deleting line2, we should have line1 and line3, with cursor on line3 (now at index 1)
      expect(result.lines).toEqual(['line1', 'line3']);
      expect(result.cursorRow).toBe(1);
      expect(result.cursorCol).toBe(0);
    });

    it('should delete multiple lines when count > 1', () => {
      const state = createTestState(['line1', 'line2', 'line3', 'line4'], 1, 0);

      const action: TextBufferAction = {
        type: 'vim_delete_line',
        payload: { count: 2 },
      };

      const result = textBufferReducer(state, action);
      expect(result).toHaveOnlyValidCharacters();

      // Should delete line2 and line3, leaving line1 and line4
      expect(result.lines).toEqual(['line1', 'line4']);
      expect(result.cursorRow).toBe(1);
      expect(result.cursorCol).toBe(0);
    });

    it('should clear single line content when only one line exists', () => {
      const state = createTestState(['only line'], 0, 5);

      const action: TextBufferAction = {
        type: 'vim_delete_line',
        payload: { count: 1 },
      };

      const result = textBufferReducer(state, action);
      expect(result).toHaveOnlyValidCharacters();

      // Should clear the line content but keep the line
      expect(result.lines).toEqual(['']);
      expect(result.cursorRow).toBe(0);
      expect(result.cursorCol).toBe(0);
    });

    it('should handle deleting the last line properly', () => {
      const state = createTestState(['line1', 'line2'], 1, 0);

      const action: TextBufferAction = {
        type: 'vim_delete_line',
        payload: { count: 1 },
      };

      const result = textBufferReducer(state, action);
      expect(result).toHaveOnlyValidCharacters();

      // Should delete the last line completely, not leave empty line
      expect(result.lines).toEqual(['line1']);
      expect(result.cursorRow).toBe(0);
      expect(result.cursorCol).toBe(0);
    });

    it('should handle deleting all lines and maintain valid state for subsequent paste', () => {
      const state = createTestState(['line1', 'line2', 'line3', 'line4'], 0, 0);

      // Delete all 4 lines with 4dd
      const deleteAction: TextBufferAction = {
        type: 'vim_delete_line',
        payload: { count: 4 },
      };

      const afterDelete = textBufferReducer(state, deleteAction);
      expect(afterDelete).toHaveOnlyValidCharacters();

      // After deleting all lines, should have one empty line
      expect(afterDelete.lines).toEqual(['']);
      expect(afterDelete.cursorRow).toBe(0);
      expect(afterDelete.cursorCol).toBe(0);

      // Now paste multiline content - this should work correctly
      const pasteAction: TextBufferAction = {
        type: 'insert',
        payload: 'new1\nnew2\nnew3\nnew4',
      };

      const afterPaste = textBufferReducer(afterDelete, pasteAction);
      expect(afterPaste).toHaveOnlyValidCharacters();

      // All lines including the first one should be present
      expect(afterPaste.lines).toEqual(['new1', 'new2', 'new3', 'new4']);
      expect(afterPaste.cursorRow).toBe(3);
      expect(afterPaste.cursorCol).toBe(4);
    });
  });
});
