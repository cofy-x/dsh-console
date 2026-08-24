/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest';
import {
  validateSettings,
  formatValidationError,
  settingsZodSchema,
} from './settings-validation.js';
import { z } from 'zod';

describe('settings-validation', () => {
  describe('validateSettings', () => {
    it('should accept valid settings', () => {
      const validSettings = {
        general: {
          vimMode: true,
        },
        ui: {
          theme: 'dark',
        },
      };

      const result = validateSettings(validSettings);
      expect(result.success).toBe(true);
    });

    it('should accept empty settings object', () => {
      const emptySettings = {};
      const result = validateSettings(emptySettings);
      expect(result.success).toBe(true);
    });

    it('should accept unknown top-level keys (for migration compatibility)', () => {
      const settingsWithUnknownKey = {
        unknownKey: 'some value',
      };

      const result = validateSettings(settingsWithUnknownKey);
      expect(result.success).toBe(true);
      // Unknown keys are allowed via .passthrough() for migration scenarios
    });

    it('should accept nested valid settings', () => {
      const validSettings = {
        ui: {
          theme: 'dark',
          hideWindowTitle: true,
          footer: {
            hideCWD: false,
            hideModelInfo: true,
          },
        },
      };

      const result = validateSettings(validSettings);
      expect(result.success).toBe(true);
    });

    it('should validate boolean fields correctly', () => {
      const validSettings = {
        general: {
          vimMode: true,
          disableAutoUpdate: false,
        },
      };

      const result = validateSettings(validSettings);
      expect(result.success).toBe(true);
    });

    it('should reject non-boolean values for boolean fields', () => {
      const invalidSettings = {
        general: {
          vimMode: 'yes',
        },
      };

      const result = validateSettings(invalidSettings);
      expect(result.success).toBe(false);
    });

    it('should validate complex nested customThemes configuration', () => {
      const invalidSettings = {
        ui: {
          customThemes: {
            'my-theme': {
              type: 'custom',
              // Missing 'name' property which is required
              text: {
                primary: '#ffffff',
              },
            },
          },
        },
      };

      const result = validateSettings(invalidSettings);
      expect(result.success).toBe(false);
      if (result.error) {
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(result.error.issues.length).toBeGreaterThan(0);
        // Should complain about missing 'name'
        const issue = result.error.issues.find(
          (i) => i.code === 'invalid_type' && i.message.includes('Required'),
        );
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(issue).toBeDefined();
      }
    });
  });

  describe('formatValidationError', () => {
    it('should format error with file path and helpful message', () => {
      const invalidSettings = {
        general: {
          vimMode: {},
        },
      };

      const result = validateSettings(invalidSettings);
      expect(result.success).toBe(false);

      if (result.error) {
        const formatted = formatValidationError(
          result.error,
          '/path/to/settings.json',
        );

        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted).toContain('/path/to/settings.json');
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted).toContain('general.vimMode');
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted).toContain('Expected: boolean, but received: object');
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted).toContain('Please fix the configuration.');
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted).toContain('https://github.com/cofy-x/dsh-console');
      }
    });

    it('should include link to documentation', () => {
      const invalidSettings = {
        general: {
          vimMode: { invalid: 'object' },
        },
      };

      const result = validateSettings(invalidSettings);
      expect(result.success).toBe(false);

      if (result.error) {
        const formatted = formatValidationError(result.error, 'test.json');

        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted).toContain('https://github.com/cofy-x/dsh-console');
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted).toContain('configuration.md');
      }
    });

    it('should list all validation errors', () => {
      const invalidSettings = {
        general: {
          vimMode: 'not a boolean',
        },
        ui: { theme: 123 },
      };

      const result = validateSettings(invalidSettings);
      expect(result.success).toBe(false);

      if (result.error) {
        const formatted = formatValidationError(result.error, 'test.json');

        // Should have multiple errors listed
        // eslint-disable-next-line vitest/no-conditional-expect
        expect(formatted.match(/Error in:/g)?.length).toBeGreaterThan(1);
      }
    });

  });

  describe('settingsZodSchema', () => {
    it('should be a valid Zod object schema', () => {
      expect(settingsZodSchema).toBeInstanceOf(z.ZodObject);
    });

    it('should have optional fields', () => {
      // All top-level fields should be optional
      const shape = settingsZodSchema.shape;
      expect(shape['general']).toBeDefined();
      expect(shape['ui']).toBeDefined();
      expect(shape['tools']).toBeDefined();

      // Test that empty object is valid (all fields optional)
      const result = settingsZodSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
