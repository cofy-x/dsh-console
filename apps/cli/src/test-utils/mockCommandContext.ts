/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi } from 'vitest';
import type { CommandContext } from '../ui/commands/types.js';
import type { SessionStatsState } from '../ui/contexts/session-context.js';

// A utility type to make all properties of an object, and its nested objects, partial.
type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Creates a deep, fully-typed mock of the CommandContext for use in tests.
 * All functions are pre-mocked with `vi.fn()`.
 *
 * @param overrides - A deep partial object to override any default mock values.
 * @returns A complete, mocked CommandContext object.
 */
export const createMockCommandContext = (
  overrides: DeepPartial<CommandContext> = {},
): CommandContext => {
  const defaultMocks: CommandContext = {
    invocation: {
      raw: '',
      name: '',
      args: '',
    },
    services: {},
    ui: {
      addItem: vi.fn(),
      clear: vi.fn(),
      loadHistory: vi.fn(),
      toggleDebugProfiler: vi.fn(),
      toggleVimEnabled: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    session: {
      stats: {
        sessionStartTime: new Date(),
        lastPromptTokenCount: 0,
        metrics: {
          models: {},
          tools: {
            totalCalls: 0,
            totalSuccess: 0,
            totalFail: 0,
            byName: {},
          },
        },
      } as SessionStatsState,
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merge = (target: any, source: any): any => {
    const output = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = output[key];

        if (
          // We only want to recursively merge plain objects
          Object.prototype.toString.call(sourceValue) === '[object Object]' &&
          Object.prototype.toString.call(targetValue) === '[object Object]'
        ) {
          output[key] = merge(targetValue, sourceValue);
        } else {
          // If not, we do a direct assignment. This preserves Date objects and others.
          output[key] = sourceValue;
        }
      }
    }
    return output;
  };

  return merge(defaultMocks, overrides);
};
