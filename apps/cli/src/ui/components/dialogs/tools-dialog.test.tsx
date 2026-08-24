/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import type { ToolCatalogRuntime } from '../../tool-catalog-runtime.js';
import { ToolsDialog } from './tools-dialog.js';

describe('ToolsDialog', () => {
  it('renders the current Agent catalog and parameter details', () => {
    const snapshot = {
      tools: [
        {
          name: 'read_file',
          description: 'Read one workspace file.',
          parameters: [
            {
              name: 'path',
              type: 'string',
              description: 'Workspace-relative path.',
              required: true,
            },
          ],
        },
      ],
    } as const;
    const runtime: ToolCatalogRuntime = {
      getSnapshot: () => snapshot,
      subscribe: () => vi.fn(),
    };

    const { lastFrame } = renderWithProviders(
      <ToolsDialog runtime={runtime} onClose={vi.fn()} />,
    );

    expect(lastFrame()).toContain('DSH Tools (1)');
    expect(lastFrame()).toContain('read_file');
    expect(lastFrame()).toContain('Workspace-relative path.');
    expect(lastFrame()).toContain('string required');
  });

  it('renders an empty Agent catalog', () => {
    const snapshot = { tools: [] } as const;
    const runtime: ToolCatalogRuntime = {
      getSnapshot: () => snapshot,
      subscribe: () => vi.fn(),
    };
    const { lastFrame } = renderWithProviders(
      <ToolsDialog runtime={runtime} onClose={vi.fn()} />,
    );
    expect(lastFrame()).toContain('No tools are visible to the current Agent.');
  });
});
