/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect } from 'vitest';
import { createMockCommandContext } from './mockCommandContext.js';

describe('createMockCommandContext', () => {
  it('should return a valid CommandContext object with default mocks', () => {
    const context = createMockCommandContext();

    // Just a few spot checks to ensure the structure is correct
    // and functions are mocks.
    expect(context).toBeDefined();
    expect(context.ui.addItem).toBeInstanceOf(Function);
    expect(vi.isMockFunction(context.ui.addItem)).toBe(true);
  });

  it('should apply top-level overrides correctly', () => {
    const mockClear = vi.fn();
    const overrides = {
      ui: {
        clear: mockClear,
      },
    };

    const context = createMockCommandContext(overrides);

    // Call the function to see if the override was used
    context.ui.clear();

    // Assert that our specific mock was called, not the default
    expect(mockClear).toHaveBeenCalled();
    // And that other defaults are still in place
    expect(vi.isMockFunction(context.ui.addItem)).toBe(true);
  });

  it('should apply deeply nested overrides correctly', () => {
    const overrides = {
      session: {
        stats: {
          sessionId: 'dsh-console-test',
        },
      },
    };

    const context = createMockCommandContext(overrides);

    expect(context.session.stats.sessionId).toBe('dsh-console-test');
    expect(context.session.stats.lastPromptTokenCount).toBe(0);
  });
});
