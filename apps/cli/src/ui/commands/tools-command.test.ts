/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import type { ToolCatalogRuntime } from '../tool-catalog-runtime.js';
import { toolsCommand } from './tools-command.js';

describe('toolsCommand', () => {
  it('opens the DSH tools dialog', () => {
    const runtime: ToolCatalogRuntime = {
      getSnapshot: () => ({ tools: [] }),
      subscribe: () => vi.fn(),
    };
    const context = createMockCommandContext({
      services: { toolCatalog: runtime },
    });

    const result = toolsCommand.action?.(context, '');

    expect(result).toMatchObject({ type: 'custom_dialog' });
  });

  it('reports an unavailable catalog', () => {
    const result = toolsCommand.action?.(createMockCommandContext(), '');
    expect(result).toEqual({
      type: 'message',
      messageType: 'error',
      content: 'DSH tool catalog is unavailable.',
    });
  });
});
