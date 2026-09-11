/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../../test-utils/render.js';
import { SuggestionsDisplay } from './suggestions-display.js';
import { describe, it, expect } from 'vitest';
import { CommandKind } from '../../commands/types.js';

describe('SuggestionsDisplay', () => {
  const mockSuggestions = [
    { label: 'Command 1', value: 'command1', description: 'Description 1' },
    { label: 'Command 2', value: 'command2', description: 'Description 2' },
    { label: 'Command 3', value: 'command3', description: 'Description 3' },
  ];

  it('renders loading state', () => {
    const { lastFrame } = render(
      <SuggestionsDisplay
        suggestions={[]}
        activeIndex={0}
        isLoading={true}
        width={80}
        scrollOffset={0}
        userInput=""
        mode="reverse"
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('renders nothing when empty and not loading', () => {
    const { lastFrame } = render(
      <SuggestionsDisplay
        suggestions={[]}
        activeIndex={0}
        isLoading={false}
        width={80}
        scrollOffset={0}
        userInput=""
        mode="reverse"
      />,
    );
    expect(lastFrame()).toBe('');
  });

  it('renders suggestions list', () => {
    const { lastFrame } = render(
      <SuggestionsDisplay
        suggestions={mockSuggestions}
        activeIndex={0}
        isLoading={false}
        width={80}
        scrollOffset={0}
        userInput=""
        mode="reverse"
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('highlights active item', () => {
    // This test relies on visual inspection or implementation details (colors)
    // For now, we just ensure it renders without error and contains the item
    const { lastFrame } = render(
      <SuggestionsDisplay
        suggestions={mockSuggestions}
        activeIndex={1}
        isLoading={false}
        width={80}
        scrollOffset={0}
        userInput=""
        mode="reverse"
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('handles scrolling', () => {
    const manySuggestions = Array.from({ length: 20 }, (_, i) => ({
      label: `Cmd ${i}`,
      value: `Cmd ${i}`,
      description: `Description ${i}`,
    }));

    const { lastFrame } = render(
      <SuggestionsDisplay
        suggestions={manySuggestions}
        activeIndex={10}
        isLoading={false}
        width={80}
        scrollOffset={5}
        userInput=""
        mode="reverse"
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('labels Skill slash commands without labeling ordinary commands', () => {
    const { lastFrame } = render(
      <SuggestionsDisplay
        suggestions={[
          {
            label: 'help',
            value: 'help',
            description: 'Built-in command',
            commandKind: CommandKind.BUILT_IN,
          },
          {
            label: 'compact',
            value: 'compact',
            description: 'DSH command',
            commandKind: CommandKind.DSH,
          },
          {
            label: 'review-pr',
            value: 'review-pr',
            description: 'Skill command',
            commandKind: CommandKind.SKILL,
          },
        ]}
        activeIndex={0}
        isLoading={false}
        width={80}
        scrollOffset={0}
        userInput="/"
        mode="slash"
      />,
    );

    expect(lastFrame()).toContain('Built-in command');
    expect(lastFrame()).not.toContain('[built-in]');
    expect(lastFrame()).toContain('DSH command');
    expect(lastFrame()).not.toContain('[dsh]');
    expect(lastFrame()).toContain('[skill] Skill command');
  });
});
