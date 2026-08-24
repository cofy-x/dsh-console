/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { isSlashCommand } from './utils.js';

describe('command utils', () => {
  describe('isSlashCommand', () => {
    it('should return true when query starts with /', () => {
      expect(isSlashCommand('/help')).toBe(true);
      expect(isSlashCommand('/memory show')).toBe(true);
      expect(isSlashCommand('/clear')).toBe(true);
      expect(isSlashCommand('/')).toBe(true);
    });

    it('should return false when query does not start with /', () => {
      expect(isSlashCommand('help')).toBe(false);
      expect(isSlashCommand('memory show')).toBe(false);
      expect(isSlashCommand('')).toBe(false);
      expect(isSlashCommand('path/to/file')).toBe(false);
      expect(isSlashCommand(' /help')).toBe(false);
    });

    it('should return false for line comments starting with //', () => {
      expect(isSlashCommand('// This is a comment')).toBe(false);
      expect(isSlashCommand('// check if variants base info all filled.')).toBe(
        false,
      );
      expect(isSlashCommand('//comment without space')).toBe(false);
    });

    it('should return false for block comments starting with /*', () => {
      expect(isSlashCommand('/* This is a block comment */')).toBe(false);
      expect(isSlashCommand('/*\n * Multi-line comment\n */')).toBe(false);
      expect(isSlashCommand('/*comment without space*/')).toBe(false);
    });
  });
});
