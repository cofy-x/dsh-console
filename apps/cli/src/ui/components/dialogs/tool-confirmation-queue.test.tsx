/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { ToolConfirmationQueue } from './tool-confirmation-queue.js';
import { renderWithProviders } from '../../../test-utils/render.js';

describe('ToolConfirmationQueue', () => {
  it('renders a canonical DSH approval request', () => {
    const respond = vi.fn();
    const { lastFrame } = renderWithProviders(
      <ToolConfirmationQueue
        request={{
          id: 'approval-1',
          toolName: 'bash',
          callId: 'call-1',
          reason: 'Write access outside the workspace is required.',
        }}
        index={1}
        total={2}
        terminalWidth={80}
        respond={respond}
      />,
    );

    const output = lastFrame();
    expect(output).toContain('Action Required');
    expect(output).toContain('1 of 2');
    expect(output).toContain('bash');
    expect(output).toContain('Call call-1');
    expect(output).toContain('Write access outside the workspace is required.');
    expect(output).toContain('Allow once');
    expect(output).toContain('Reject');
  });
});
