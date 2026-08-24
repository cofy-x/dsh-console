/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * RadioButtonSelect Demo
 *
 * This demo showcases all features of RadioButtonSelect:
 * - Basic usage with simple labels
 * - With and without numbers
 * - Scrolling for long lists
 * - Disabled items
 * - Theme display (themeNameDisplay + themeTypeDisplay)
 * - Keyboard navigation
 * - Focused and unfocused states
 * - Scroll arrows
 *
 * Controls:
 * - Use ←/→ to switch between sections
 * - Use ↑/↓ to navigate within the current section
 * - Press Enter or Ctrl+C to exit
 *
 * Usage:
 *   pnpm run example examples/src/component/shared/radio-button-select.tsx
 */

import { render, Box, Text } from 'ink';
import { useState, useCallback, useMemo } from 'react';
import { RadioButtonSelect } from '../../../../src/ui/components/shared/radio-button-select.js';
import type { RadioSelectItem } from '../../../../src/ui/components/shared/radio-button-select.js';
import { KeypressProvider } from '../../../../src/ui/contexts/keypress-context.js';
import { useKeypress } from '../../../../src/ui/hooks/input/use-keypress.js';
import type { Key } from '../../../../src/terminal/keys.js';

type LanguageOption = 'typescript' | 'javascript' | 'python' | 'rust' | 'go';
type ThemeOption = 'dark' | 'light' | 'auto';
type ColorOption = 'red' | 'green' | 'blue' | 'yellow';

type SectionId =
  | 'language'
  | 'theme'
  | 'longList'
  | 'color'
  | 'noNumbers'
  | 'unfocused';

const SECTIONS: SectionId[] = [
  'language',
  'theme',
  'longList',
  'color',
  'noNumbers',
  'unfocused',
];

interface SectionConfig {
  title: string;
  description: string;
  borderColor: string;
}

const SECTION_CONFIGS: Record<SectionId, SectionConfig> = {
  language: {
    title: 'Section 1: Basic Usage (with numbers)',
    description: 'Select a programming language:',
    borderColor: 'cyan',
  },
  theme: {
    title: 'Section 2: Theme Display (themeNameDisplay + themeTypeDisplay)',
    description: 'Select a theme:',
    borderColor: 'magenta',
  },
  longList: {
    title: 'Section 3: Long List with Scrolling (25 items)',
    description: 'Select from a long list (scroll to see more):',
    borderColor: 'yellow',
  },
  color: {
    title: 'Section 4: Disabled Items',
    description: 'Select a color (Blue is disabled):',
    borderColor: 'red',
  },
  noNumbers: {
    title: 'Section 5: Without Numbers (showNumbers=false)',
    description: 'Simple selection without numbers:',
    borderColor: 'green',
  },
  unfocused: {
    title: 'Section 6: Unfocused State (isFocused=false)',
    description:
      'This section demonstrates unfocused state (numbers are dimmed):',
    borderColor: 'blue',
  },
};

function DemoContent() {
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguageOption | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption | null>(null);
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null);
  const [highlightedItem, setHighlightedItem] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const currentSectionId = SECTIONS[currentSectionIndex]!;

  // Section 1: Basic usage with simple labels
  const languageItems: RadioSelectItem<LanguageOption>[] = useMemo(
    () => [
      { key: 'typescript', label: 'TypeScript', value: 'typescript' },
      { key: 'javascript', label: 'JavaScript', value: 'javascript' },
      { key: 'python', label: 'Python', value: 'python' },
      { key: 'rust', label: 'Rust', value: 'rust' },
      { key: 'go', label: 'Go', value: 'go' },
    ],
    [],
  );

  // Section 2: Theme display (themeNameDisplay + themeTypeDisplay)
  const themeItems: RadioSelectItem<ThemeOption>[] = useMemo(
    () => [
      {
        key: 'dark',
        label: 'Dark Theme',
        value: 'dark',
        themeNameDisplay: 'Dark Theme',
        themeTypeDisplay: '(built-in)',
      },
      {
        key: 'light',
        label: 'Light Theme',
        value: 'light',
        themeNameDisplay: 'Light Theme',
        themeTypeDisplay: '(built-in)',
      },
      {
        key: 'auto',
        label: 'Auto Theme',
        value: 'auto',
        themeNameDisplay: 'Auto Theme',
        themeTypeDisplay: '(custom)',
      },
    ],
    [],
  );

  // Section 3: Long list with scrolling
  const longListItems: RadioSelectItem<number>[] = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => ({
        key: `item-${i + 1}`,
        label: `Option ${String(i + 1).padStart(2, '0')}`,
        value: i + 1,
      })),
    [],
  );

  // Section 4: With disabled items
  const colorItems: RadioSelectItem<ColorOption>[] = useMemo(
    () => [
      { key: 'red', label: 'Red', value: 'red' },
      { key: 'green', label: 'Green', value: 'green', disabled: false },
      { key: 'blue', label: 'Blue', value: 'blue', disabled: true },
      { key: 'yellow', label: 'Yellow', value: 'yellow', disabled: false },
    ],
    [],
  );

  // Section 5: Without numbers
  const simpleItems: RadioSelectItem<string>[] = useMemo(
    () => [
      { key: 'option1', label: 'First Option', value: 'option1' },
      { key: 'option2', label: 'Second Option', value: 'option2' },
      { key: 'option3', label: 'Third Option', value: 'option3' },
    ],
    [],
  );

  const handleLanguageSelect = useCallback((value: LanguageOption) => {
    setSelectedLanguage(value);
  }, []);

  const handleThemeSelect = useCallback((value: ThemeOption) => {
    setSelectedTheme(value);
  }, []);

  const handleColorSelect = useCallback((value: ColorOption) => {
    setSelectedColor(value);
  }, []);

  const handleLanguageHighlight = useCallback((value: LanguageOption) => {
    setHighlightedItem(`Language: ${value}`);
  }, []);

  const handleThemeHighlight = useCallback((value: ThemeOption) => {
    setHighlightedItem(`Theme: ${value}`);
  }, []);

  const handleColorHighlight = useCallback((value: ColorOption) => {
    setHighlightedItem(`Color: ${value}`);
  }, []);

  // Handle keyboard navigation for section switching
  useKeypress(
    (key: Key) => {
      const { name, ctrl, sequence } = key;

      // Ctrl+C to exit (check both ctrl+c and the sequence)
      if ((ctrl && name === 'c') || sequence === '\u0003') {
        process.exit(0);
      }

      // Enter to exit
      if (name === 'return') {
        process.exit(0);
      }

      // Left arrow key to go to previous section
      if (name === 'left') {
        setCurrentSectionIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      // Right arrow key to go to next section
      if (name === 'right') {
        setCurrentSectionIndex((prev) =>
          Math.min(SECTIONS.length - 1, prev + 1),
        );
        return;
      }

      // Up/Down arrows are handled by RadioButtonSelect internally
      // when isFocused is true
    },
    { isActive: true },
  );

  const config = SECTION_CONFIGS[currentSectionId];

  return (
    <Box flexDirection="column" paddingX={1} gap={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          RadioButtonSelect Comprehensive Demo
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Text color="yellow" bold>
          Controls:
        </Text>
        <Text color="gray">
          Use <Text color="cyan">←/→</Text> to switch sections,{' '}
          <Text color="cyan">↑/↓</Text> to navigate within section,{' '}
          <Text color="cyan">Enter</Text> or <Text color="cyan">Ctrl+C</Text> to
          exit
        </Text>
        <Box marginTop={1}>
          <Text color="gray">
            Section {currentSectionIndex + 1} of {SECTIONS.length}:{' '}
            <Text color="cyan">{currentSectionId}</Text>
          </Text>
        </Box>
      </Box>

      {/* Display current section only */}
      <Box flexDirection="column" gap={0}>
        <Text
          color={
            config.borderColor as
              | 'cyan'
              | 'magenta'
              | 'yellow'
              | 'red'
              | 'green'
              | 'blue'
          }
          bold
        >
          {config.title}
        </Text>
        <Box
          borderStyle="round"
          borderColor={
            config.borderColor as
              | 'cyan'
              | 'magenta'
              | 'yellow'
              | 'red'
              | 'green'
              | 'blue'
          }
          paddingX={1}
          paddingY={0}
        >
          <Text
            color={
              config.borderColor as
                | 'cyan'
                | 'magenta'
                | 'yellow'
                | 'red'
                | 'green'
                | 'blue'
            }
          >
            {config.description}
          </Text>

          {currentSectionId === 'language' && (
            <>
              <RadioButtonSelect
                items={languageItems}
                initialIndex={0}
                onSelect={handleLanguageSelect}
                onHighlight={handleLanguageHighlight}
                isFocused={true}
                showNumbers={true}
                maxItemsToShow={10}
                showScrollArrows={false}
              />
              {selectedLanguage && (
                <Box marginTop={1}>
                  <Text color="green">
                    Selected: <Text color="yellow">{selectedLanguage}</Text>
                  </Text>
                </Box>
              )}
            </>
          )}

          {currentSectionId === 'theme' && (
            <>
              <RadioButtonSelect
                items={themeItems}
                initialIndex={0}
                onSelect={handleThemeSelect}
                onHighlight={handleThemeHighlight}
                isFocused={true}
                showNumbers={true}
                maxItemsToShow={10}
                showScrollArrows={false}
              />
              {selectedTheme && (
                <Box marginTop={1}>
                  <Text color="green">
                    Selected: <Text color="yellow">{selectedTheme}</Text>
                  </Text>
                </Box>
              )}
            </>
          )}

          {currentSectionId === 'longList' && (
            <RadioButtonSelect
              items={longListItems}
              initialIndex={0}
              onSelect={(value) => {
                setHighlightedItem(`Selected option: ${value}`);
              }}
              isFocused={true}
              showNumbers={true}
              showScrollArrows={true}
              maxItemsToShow={5}
            />
          )}

          {currentSectionId === 'color' && (
            <>
              <RadioButtonSelect
                items={colorItems}
                initialIndex={0}
                onSelect={handleColorSelect}
                onHighlight={handleColorHighlight}
                isFocused={true}
                showNumbers={true}
                maxItemsToShow={10}
                showScrollArrows={false}
              />
              {selectedColor && (
                <Box marginTop={1}>
                  <Text color="green">
                    Selected: <Text color="yellow">{selectedColor}</Text>
                  </Text>
                </Box>
              )}
            </>
          )}

          {currentSectionId === 'noNumbers' && (
            <RadioButtonSelect
              items={simpleItems}
              initialIndex={0}
              onSelect={(value) => {
                setHighlightedItem(`Selected: ${value}`);
              }}
              isFocused={true}
              showNumbers={false}
              maxItemsToShow={10}
              showScrollArrows={false}
            />
          )}

          {currentSectionId === 'unfocused' && (
            <RadioButtonSelect
              items={languageItems}
              initialIndex={1}
              onSelect={handleLanguageSelect}
              isFocused={false}
              showNumbers={true}
              maxItemsToShow={10}
              showScrollArrows={false}
            />
          )}
        </Box>
      </Box>

      {/* Status Display */}
      {highlightedItem && (
        <Box marginTop={1}>
          <Text color="gray">
            Highlighted: <Text color="cyan">{highlightedItem}</Text>
          </Text>
        </Box>
      )}

      {/* Instructions */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Tip: Use ←/→ to switch between sections. Use ↑/↓ to navigate within
          the current section. Press Enter or Ctrl+C to exit.
        </Text>
      </Box>
    </Box>
  );
}

function Demo() {
  return (
    <KeypressProvider>
      <DemoContent />
    </KeypressProvider>
  );
}

export async function main() {
  await new Promise<void>((resolve) => {
    const { unmount } = render(<Demo />);

    // Handle process exit
    const handleExit = () => {
      unmount();
      resolve();
    };

    process.on('SIGINT', handleExit);

    // Note: The demo will exit when user presses Enter or Ctrl+C,
    // which is handled in DemoContent component
    // We keep this timeout as a fallback for CI environments
    setTimeout(() => {
      unmount();
      resolve();
    }, 300000); // 5 minutes timeout for manual testing
  });
}

main().catch((error) => {
  console.error('An unexpected critical error occurred:');
  if (error instanceof Error) {
    console.error(error.stack);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
