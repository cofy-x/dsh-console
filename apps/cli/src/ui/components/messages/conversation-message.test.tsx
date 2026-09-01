/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  createMockSettings,
  renderWithProviders,
  simulateClick,
} from '../../../test-utils/render.js';
import { ConversationMessage } from './conversation-message.js';

const content = [
  { type: 'reasoning' as const, text: 'Inspect the event stream.' },
  { type: 'text' as const, text: '**Answer**' },
  {
    type: 'image' as const,
    attachment: {
      attachmentId: 'attachment-1',
      mediaType: 'image/png',
      bytes: 42,
      width: 10,
      height: 20,
      name: 'diagram.png',
    },
  },
];

describe('ConversationMessage', () => {
  it('collapses completed reasoning in auto mode', () => {
    const { lastFrame } = renderWithProviders(
      <ConversationMessage content={content} interrupted terminalWidth={80} />,
      { settings: createMockSettings({ ui: { reasoningDisplay: 'auto' } }) },
    );
    const output = lastFrame();
    expect(output).toContain('Thinking interrupted');
    expect(output).toContain('collapsed');
    expect(output).toContain('click to expand');
    expect(output).not.toContain('Inspect the event stream.');
    expect(output).toContain('Answer');
    expect(output).toContain('diagram.png');
    expect(output).toContain('image/png');
    expect(output).toContain('10x20');
    expect(output).toContain('Response interrupted before completion.');
  });

  it('previews pending reasoning in auto mode', () => {
    const { lastFrame } = renderWithProviders(
      <ConversationMessage content={content} pending terminalWidth={80} />,
      { settings: createMockSettings({ ui: { reasoningDisplay: 'auto' } }) },
    );
    const output = lastFrame();
    expect(output).toContain('Thinking...');
    expect(output).toContain('Inspect the event stream.');
  });

  it('expands a completed auto reasoning block when clicked', async () => {
    const { lastFrame, stdin } = renderWithProviders(
      <ConversationMessage content={content} terminalWidth={80} />,
      {
        settings: createMockSettings({ ui: { reasoningDisplay: 'auto' } }),
        mouseEventsEnabled: true,
      },
    );

    expect(lastFrame()).not.toContain('Inspect the event stream.');
    await simulateClick(stdin, 4, 1);
    expect(lastFrame()).toContain('Inspect the event stream.');
    expect(lastFrame()).toContain('click to collapse');
  });

  it('bounds a pending single-line reasoning preview in auto mode', () => {
    const longReasoning = 'x'.repeat(1_000);
    const { lastFrame } = renderWithProviders(
      <ConversationMessage
        content={[{ type: 'reasoning', text: longReasoning }]}
        pending
        terminalWidth={80}
      />,
      { settings: createMockSettings({ ui: { reasoningDisplay: 'auto' } }) },
    );
    const output = lastFrame();
    expect(output).toContain('...');
    expect(output).not.toContain(longReasoning);
    expect(output?.length ?? Number.POSITIVE_INFINITY).toBeLessThan(500);
  });

  it('keeps completed reasoning visible in expanded mode', () => {
    const { lastFrame } = renderWithProviders(
      <ConversationMessage content={content} terminalWidth={80} />,
      {
        settings: createMockSettings({ ui: { reasoningDisplay: 'expanded' } }),
      },
    );
    const output = lastFrame();
    expect(output).toContain('Thought');
    expect(output).toContain('Inspect the event stream.');
    expect(output).toContain('click to collapse');
  });

  it('separates visible reasoning from the following answer', () => {
    const { lastFrame } = renderWithProviders(
      <ConversationMessage content={content} terminalWidth={80} />,
      {
        settings: createMockSettings({ ui: { reasoningDisplay: 'expanded' } }),
      },
    );

    expect(lastFrame()).toMatch(/Inspect the event stream\.\n\s*\n\s*Answer/);
  });

  it('hides reasoning without hiding visible assistant text', () => {
    const { lastFrame } = renderWithProviders(
      <ConversationMessage content={content} terminalWidth={80} />,
      { settings: createMockSettings({ ui: { reasoningDisplay: 'hidden' } }) },
    );
    const output = lastFrame();
    expect(output).not.toContain('Inspect the event stream.');
    expect(output).toContain('Answer');
  });

  it('does not turn adjacent DSH content blocks into paragraph spacing', () => {
    const { lastFrame } = renderWithProviders(
      <ConversationMessage
        content={[
          { type: 'text', text: 'First block.' },
          { type: 'text', text: 'Second block.' },
        ]}
        terminalWidth={80}
      />,
    );

    expect(lastFrame()).toContain('First block.\n  Second block.');
    expect(lastFrame()).not.toContain('First block.\n\n  Second block.');
  });
});
