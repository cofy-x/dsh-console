/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test-utils/render.js';
import {
  ExtensionContentBlock,
  registerExtensionContentRenderer,
} from './extension-content-block.js';

describe('ExtensionContentBlock', () => {
  it('renders a control-character-safe JSON fallback', () => {
    const { lastFrame } = renderWithProviders(
      <ExtensionContentBlock
        block={{
          type: 'extension',
          blockType: 'chart',
          payload: { title: '\u001b[31munsafe' },
        }}
      />,
    );
    expect(lastFrame()).toContain('DSH content: chart');
    expect(lastFrame()).toContain('\\u001b[31munsafe');
    expect(lastFrame()).not.toContain('\u001b[31munsafe');
  });

  it('uses and disposes a registered block renderer', () => {
    const dispose = registerExtensionContentRenderer(
      'chart',
      ({ block }) => <Text>custom {block.blockType}</Text>,
    );
    const block = { type: 'extension' as const, blockType: 'chart', payload: {} };
    expect(
      renderWithProviders(<ExtensionContentBlock block={block} />).lastFrame(),
    ).toContain('custom chart');
    dispose();
    expect(
      renderWithProviders(<ExtensionContentBlock block={block} />).lastFrame(),
    ).toContain('DSH content: chart');
  });
});
