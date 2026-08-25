/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { AboutBox } from './about-box.js';
import { describe, it, expect, vi } from 'vitest';

// Mock GIT_COMMIT_INFO
vi.mock('../../../generated/git-commit.js', () => ({
  GIT_COMMIT_INFO: 'mock-commit-hash',
}));

describe('AboutBox', () => {
  const defaultProps = {
    cliVersion: '1.0.0',
    osVersion: 'macOS',
    modelVersion: 'deepseek/deepseek-chat',
  };

  it('renders with required props', () => {
    const { lastFrame } = render(<AboutBox {...defaultProps} />);
    const output = lastFrame();
    expect(output).toContain('About DSH Console');
    expect(output).toContain('1.0.0');
    expect(output).toContain('mock-commit-hash');
    expect(output).toContain('deepseek/deepseek-chat');
    expect(output).toContain('macOS');
    expect(output).toContain('Pokefetch by cofy-x');
    expect(output).toContain('https://github.com/cofy-x/pokefetch');
  });
});
