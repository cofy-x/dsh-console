/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { CommandInitDisplay } from './command-init-display.js';
import { describe, it, expect, vi } from 'vitest';
import { Text } from 'ink';

// Mock AgentSpinner
vi.mock('../indicators/agent-responding-spinner.js', () => ({
  AgentSpinner: () => <Text>Spinner</Text>,
}));

describe('CommandInitDisplay', () => {
  it('renders initial state', () => {
    const { lastFrame } = render(<CommandInitDisplay />);
    expect(lastFrame()).toContain('Spinner Loading commands...');
  });

  it('renders a custom command loading message', () => {
    const { lastFrame } = render(
      <CommandInitDisplay message="Loading DSH commands..." />,
    );
    expect(lastFrame()).toContain('Spinner Loading DSH commands...');
  });
});
