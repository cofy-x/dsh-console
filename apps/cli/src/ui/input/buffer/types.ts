/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const LARGE_PASTE_LINE_THRESHOLD = 5;
export const LARGE_PASTE_CHAR_THRESHOLD = 500;

// Regex to match paste placeholders like [Pasted Text: 6 lines] or [Pasted Text: 501 chars #2]
export const PASTED_TEXT_PLACEHOLDER_REGEX =
  /\[Pasted Text: \d+ (?:lines|chars)(?: #\d+)?\]/g;

/**
 * Represents an atomic placeholder that should be deleted as a unit.
 * Extensible to support future placeholder types.
 */
export interface AtomicPlaceholder {
  start: number; // Start position in logical text
  end: number; // End position in logical text
  type: 'paste' | 'image'; // Type for cleanup logic
  id?: string; // For paste placeholders: the pastedContent key
}

export type Direction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'wordLeft'
  | 'wordRight'
  | 'home'
  | 'end';

/**
 * Transformations allow for the CLI to render terse representations of things like file paths
 * (e.g., "@some/path/to/an/image.png" to "[Image image.png]")
 * When the cursor enters a transformed representation, it expands to reveal the logical representation.
 * (e.g., "[Image image.png]" to "@some/path/to/an/image.png")
 */
export interface Transformation {
  logStart: number;
  logEnd: number;
  logicalText: string;
  collapsedText: string;
  type: 'image' | 'paste';
  id?: string; // For paste placeholders
}

export interface VisualLayout {
  visualLines: string[];
  // For each logical line, an array of [visualLineIndex, startColInLogical]
  logicalToVisualMap: Array<Array<[number, number]>>;
  // For each visual line, its [logicalLineIndex, startColInLogical]
  visualToLogicalMap: Array<[number, number]>;
  // Image paths are transformed (e.g., "@some/path/to/an/image.png" to "[Image image.png]")
  // For each logical line, an array that maps each transformedCol to a logicalCol
  transformedToLogicalMaps: number[][];
  // For each visual line, its [startColInTransformed]
  visualToTransformedMap: number[];
}

export interface UndoHistoryEntry {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  pastedContent: Record<string, string>;
  expandedPaste: ExpandedPasteInfo | null;
}

export interface ExpandedPasteInfo {
  id: string;
  startLine: number;
  lineCount: number;
  prefix: string;
  suffix: string;
}

export interface TextBufferState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  transformationsByLine: Transformation[][];
  preferredCol: number | null; // This is the logical character offset in the visual line
  undoStack: UndoHistoryEntry[];
  redoStack: UndoHistoryEntry[];
  clipboard: string | null;
  selectionAnchor: [number, number] | null;
  viewportWidth: number;
  viewportHeight: number;
  visualLayout: VisualLayout;
  pastedContent: Record<string, string>;
  expandedPaste: ExpandedPasteInfo | null;
}

export interface TextBufferOptions {
  inputFilter?: (text: string) => string;
  singleLine?: boolean;
}

export type TextBufferAction =
  | { type: 'set_text'; payload: string; pushToUndo?: boolean }
  | { type: 'insert'; payload: string; isPaste?: boolean }
  | { type: 'add_pasted_content'; payload: { id: string; text: string } }
  | { type: 'backspace' }
  | {
      type: 'move';
      payload: {
        dir: Direction;
      };
    }
  | {
      type: 'set_cursor';
      payload: {
        cursorRow: number;
        cursorCol: number;
        preferredCol: number | null;
      };
    }
  | { type: 'delete' }
  | { type: 'delete_word_left' }
  | { type: 'delete_word_right' }
  | { type: 'kill_line_right' }
  | { type: 'kill_line_left' }
  | { type: 'undo' }
  | { type: 'redo' }
  | {
      type: 'replace_range';
      payload: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
        text: string;
      };
    }
  | { type: 'move_to_offset'; payload: { offset: number } }
  | { type: 'create_undo_snapshot' }
  | { type: 'set_viewport'; payload: { width: number; height: number } }
  | { type: 'vim_delete_word_forward'; payload: { count: number } }
  | { type: 'vim_delete_word_backward'; payload: { count: number } }
  | { type: 'vim_delete_word_end'; payload: { count: number } }
  | { type: 'vim_change_word_forward'; payload: { count: number } }
  | { type: 'vim_change_word_backward'; payload: { count: number } }
  | { type: 'vim_change_word_end'; payload: { count: number } }
  | { type: 'vim_delete_line'; payload: { count: number } }
  | { type: 'vim_change_line'; payload: { count: number } }
  | { type: 'vim_delete_to_end_of_line' }
  | { type: 'vim_change_to_end_of_line' }
  | {
      type: 'vim_change_movement';
      payload: { movement: 'h' | 'j' | 'k' | 'l'; count: number };
    }
  // New vim actions for stateless command handling
  | { type: 'vim_move_left'; payload: { count: number } }
  | { type: 'vim_move_right'; payload: { count: number } }
  | { type: 'vim_move_up'; payload: { count: number } }
  | { type: 'vim_move_down'; payload: { count: number } }
  | { type: 'vim_move_word_forward'; payload: { count: number } }
  | { type: 'vim_move_word_backward'; payload: { count: number } }
  | { type: 'vim_move_word_end'; payload: { count: number } }
  | { type: 'vim_delete_char'; payload: { count: number } }
  | { type: 'vim_insert_at_cursor' }
  | { type: 'vim_append_at_cursor' }
  | { type: 'vim_open_line_below' }
  | { type: 'vim_open_line_above' }
  | { type: 'vim_append_at_line_end' }
  | { type: 'vim_insert_at_line_start' }
  | { type: 'vim_move_to_line_start' }
  | { type: 'vim_move_to_line_end' }
  | { type: 'vim_move_to_first_nonwhitespace' }
  | { type: 'vim_move_to_first_line' }
  | { type: 'vim_move_to_last_line' }
  | { type: 'vim_move_to_line'; payload: { lineNumber: number } }
  | { type: 'vim_escape_insert_mode' }
  | {
      type: 'toggle_paste_expansion';
      payload: { id: string; row: number; col: number };
    };
