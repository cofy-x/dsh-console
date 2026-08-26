/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { render } from '../../../test-utils/render.js';
import { ContextUsageDisplay } from './context-usage-display.js';

describe('ContextUsageDisplay', () => {
  it('shows prompt usage, model capacity, and percentage', () => {
    const { lastFrame } = render(
      <ContextUsageDisplay promptTokens={13_200} contextWindow={128_000} />,
    );

    expect(lastFrame()).toContain('13.2k/128k (10%)');
  });

  it('omits the percentage in compact mode', () => {
    const { lastFrame } = render(
      <ContextUsageDisplay
        promptTokens={13_200}
        contextWindow={128_000}
        compact
      />,
    );

    expect(lastFrame()).toContain('13.2k/128k');
    expect(lastFrame()).not.toContain('%');
  });

  it('falls back safely when the provider does not disclose a limit', () => {
    const { lastFrame } = render(
      <ContextUsageDisplay promptTokens={13_200} />,
    );

    expect(lastFrame()).toContain('13.2k/?');
  });

  it('stays hidden when neither usage nor capacity is known', () => {
    const { lastFrame } = render(
      <ContextUsageDisplay promptTokens={0} />,
    );

    expect(lastFrame()).toBe('');
  });
});
