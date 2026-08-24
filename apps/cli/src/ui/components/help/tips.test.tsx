/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { Tips } from './tips.js';
import { describe, it, expect } from 'vitest';

describe('Tips', () => {
  it('renders the general help tip', () => {
    const { lastFrame } = render(<Tips />);
    const output = lastFrame();
    expect(output).toContain('2. /help for more.');
  });
});
