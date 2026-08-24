/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MaxSizedBox Demo
 *
 * This demo showcases all features of MaxSizedBox:
 * - Overflow direction (top/bottom)
 * - Non-wrapping and wrapping text combination
 * - Nested styled Text elements
 * - Additional hidden lines count
 * - Different maxWidth and maxHeight configurations
 * - Edge cases (empty content, exact fit, etc.)
 *
 * Controls:
 *   1-6 or Up/Down arrows - Switch between sections
 *   Q or Escape - Exit
 *
 * Usage (from apps/cli directory):
 *   pnpm run example examples/src/component/max-sized-box.tsx
 */

import { render, Box, Text } from 'ink';
import { useMemo, useState, useCallback } from 'react';
import { MaxSizedBox } from '../../../src/ui/components/shared/max-sized-box.js';
import { OverflowProvider } from '../../../src/ui/contexts/overflow-context.js';
import { KeypressProvider } from '../../../src/ui/contexts/keypress-context.js';
import type { Key } from '../../../src/terminal/keys.js';
import { useKeypress } from '../../../src/ui/hooks/input/use-keypress.js';

const SECTION_COUNT = 6;

interface DemoProps {
  onExit: () => void;
}

function Demo({ onExit }: DemoProps) {
  const [currentSection, setCurrentSection] = useState(1);

  const handleKeypress = useCallback(
    (key: Key) => {
      if (key.name === 'q' || key.name === 'escape') {
        onExit();
      } else if (key.name === 'up') {
        setCurrentSection((prev) => (prev > 1 ? prev - 1 : SECTION_COUNT));
      } else if (key.name === 'down') {
        setCurrentSection((prev) => (prev < SECTION_COUNT ? prev + 1 : 1));
      } else if (key.sequence >= '1' && key.sequence <= '6') {
        setCurrentSection(parseInt(key.sequence, 10));
      }
    },
    [onExit],
  );

  useKeypress(handleKeypress, { isActive: true });

  // Demo: Overflow direction with simple single-line text
  const overflowDirectionRows = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => (
        <Box key={i + 1}>
          <Text>
            Row {String(i + 1).padStart(2, '0')}: Content line {i + 1}
          </Text>
        </Box>
      )),
    [],
  );

  // Demo: Basic usage with overflow direction
  const basicRows = useMemo(
    () => [
      <Box key={1}>
        <Text>First line of content.</Text>
      </Box>,
      <Box key={2}>
        <Text>Second line with some text.</Text>
      </Box>,
      <Box key={3}>
        <Text>Third line continues here.</Text>
      </Box>,
      <Box key={4}>
        <Text>Fourth line of content.</Text>
      </Box>,
      <Box key={5}>
        <Text>Fifth line wraps if needed.</Text>
      </Box>,
      <Box key={6}>
        <Text>Sixth line demonstrates overflow.</Text>
      </Box>,
      <Box key={7}>
        <Text>Seventh line for testing.</Text>
      </Box>,
      <Box key={8}>
        <Text>Eighth line completes the set.</Text>
      </Box>,
    ],
    [],
  );

  // Demo: Non-wrapping label + wrapping content
  const labelContentRows = useMemo(
    () => [
      <Box key={1}>
        <Text color="yellow" wrap="truncate">
          Status:{' '}
        </Text>
        <Text>
          This is a long status message that will wrap to multiple lines.
        </Text>
      </Box>,
      <Box key={2}>
        <Text color="green" wrap="truncate">
          Success:{' '}
        </Text>
        <Text>Operation completed successfully with detailed information.</Text>
      </Box>,
      <Box key={3}>
        <Text color="red" wrap="truncate">
          Error:{' '}
        </Text>
        <Text>An error occurred while processing the request.</Text>
      </Box>,
      <Box key={4}>
        <Text color="blue" wrap="truncate">
          Info:{' '}
        </Text>
        <Text>Additional information about the current operation state.</Text>
      </Box>,
    ],
    [],
  );

  // Demo: Nested styled Text elements
  const nestedStyledRows = useMemo(
    () => [
      <Box key={1}>
        <Text>
          This line contains{' '}
          <Text color="yellow" bold>
            bold yellow
          </Text>{' '}
          and{' '}
          <Text color="cyan" italic>
            italic cyan
          </Text>{' '}
          text.
        </Text>
      </Box>,
      <Box key={2}>
        <Text>
          Another example with{' '}
          <Text color="red" underline>
            underlined red
          </Text>{' '}
          and{' '}
          <Text color="green" bold>
            bold green
          </Text>
          .
        </Text>
      </Box>,
      <Box key={3}>
        <Text>
          Complex: <Text color="magenta">magenta</Text>,{' '}
          <Text color="blue">blue</Text>,{' '}
          <Text color="white" bold>
            bold white
          </Text>
          .
        </Text>
      </Box>,
    ],
    [],
  );

  // Demo: Additional hidden lines count
  const additionalHiddenRows = useMemo(
    () => [
      <Box key={1}>
        <Text>Visible line 1</Text>
      </Box>,
      <Box key={2}>
        <Text>Visible line 2</Text>
      </Box>,
      <Box key={3}>
        <Text>Visible line 3</Text>
      </Box>,
      <Box key={4}>
        <Text>Visible line 4</Text>
      </Box>,
    ],
    [],
  );

  // Demo: Exact fit (no overflow)
  const exactFitRows = useMemo(
    () => [
      <Box key={1}>
        <Text>Line 1</Text>
      </Box>,
      <Box key={2}>
        <Text>Line 2</Text>
      </Box>,
      <Box key={3}>
        <Text>Line 3</Text>
      </Box>,
    ],
    [],
  );

  // Demo: Very long text
  const longTextRows = useMemo(
    () => [
      <Box key={1}>
        <Text>
          This is an extremely long line of text that will wrap many times
          across multiple lines when constrained by the maxWidth setting.
        </Text>
      </Box>,
      <Box key={2}>
        <Text>
          Another very long line that continues the demonstration of text
          wrapping.
        </Text>
      </Box>,
    ],
    [],
  );

  const renderSection = () => {
    switch (currentSection) {
      case 1:
        return (
          <Box flexDirection="column" gap={0}>
            <Text color="cyan" bold>
              Section 1: Overflow Direction (top vs bottom)
            </Text>
            <Text color="gray">
              Shows which lines are hidden based on overflow direction
            </Text>
            <Box flexDirection="row" gap={4} marginTop={1}>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="cyan"
                paddingX={1}
              >
                <Text color="cyan">Overflow: Top</Text>
                <MaxSizedBox
                  maxWidth={35}
                  maxHeight={6}
                  overflowDirection="top"
                >
                  {overflowDirectionRows}
                </MaxSizedBox>
              </Box>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="magenta"
                paddingX={1}
              >
                <Text color="magenta">Overflow: Bottom</Text>
                <MaxSizedBox
                  maxWidth={35}
                  maxHeight={6}
                  overflowDirection="bottom"
                >
                  {overflowDirectionRows}
                </MaxSizedBox>
              </Box>
            </Box>
          </Box>
        );
      case 2:
        return (
          <Box flexDirection="column" gap={0}>
            <Text color="yellow" bold>
              Section 2: Non-wrapping Labels + Wrapping Content
            </Text>
            <Text color="gray">Labels stay on one line, content wraps</Text>
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor="yellow"
              paddingX={1}
              marginTop={1}
            >
              <MaxSizedBox
                maxWidth={60}
                maxHeight={6}
                overflowDirection="bottom"
              >
                {labelContentRows}
              </MaxSizedBox>
            </Box>
          </Box>
        );
      case 3:
        return (
          <Box flexDirection="column" gap={0}>
            <Text color="magenta" bold>
              Section 3: Nested Styled Text Elements
            </Text>
            <Text color="gray">Text with multiple nested styles preserved</Text>
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor="magenta"
              paddingX={1}
              marginTop={1}
            >
              <MaxSizedBox
                maxWidth={70}
                maxHeight={5}
                overflowDirection="bottom"
              >
                {nestedStyledRows}
              </MaxSizedBox>
            </Box>
          </Box>
        );
      case 4:
        return (
          <Box flexDirection="column" gap={0}>
            <Text color="blue" bold>
              Section 4: Additional Hidden Lines Count
            </Text>
            <Text color="gray">
              Compare with and without additionalHiddenLinesCount
            </Text>
            <Box flexDirection="row" gap={4} marginTop={1}>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="blue"
                paddingX={1}
              >
                <Text color="blue">Without additional</Text>
                <MaxSizedBox
                  maxWidth={40}
                  maxHeight={4}
                  overflowDirection="bottom"
                >
                  {additionalHiddenRows}
                </MaxSizedBox>
              </Box>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="blue"
                paddingX={1}
              >
                <Text color="blue">With additional=2</Text>
                <MaxSizedBox
                  maxWidth={40}
                  maxHeight={4}
                  overflowDirection="bottom"
                  additionalHiddenLinesCount={2}
                >
                  {additionalHiddenRows}
                </MaxSizedBox>
              </Box>
            </Box>
          </Box>
        );
      case 5:
        return (
          <Box flexDirection="column" gap={0}>
            <Text color="green" bold>
              Section 5: Edge Cases
            </Text>
            <Text color="gray">Exact fit, empty content, and long text</Text>
            <Box flexDirection="row" gap={4} marginTop={1}>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="green"
                paddingX={1}
              >
                <Text color="green">Exact Fit</Text>
                <MaxSizedBox
                  maxWidth={30}
                  maxHeight={3}
                  overflowDirection="bottom"
                >
                  {exactFitRows}
                </MaxSizedBox>
              </Box>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="green"
                paddingX={1}
              >
                <Text color="green">Empty</Text>
                <MaxSizedBox
                  maxWidth={30}
                  maxHeight={3}
                  overflowDirection="bottom"
                >
                  <Box>{null}</Box>
                </MaxSizedBox>
              </Box>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="green"
                paddingX={1}
              >
                <Text color="green">Long Text</Text>
                <MaxSizedBox
                  maxWidth={40}
                  maxHeight={5}
                  overflowDirection="bottom"
                >
                  {longTextRows}
                </MaxSizedBox>
              </Box>
            </Box>
          </Box>
        );
      case 6:
        return (
          <Box flexDirection="column" gap={0}>
            <Text color="white" bold>
              Section 6: Different Width Configurations
            </Text>
            <Text color="gray">
              Same content with different maxWidth values
            </Text>
            <Box flexDirection="row" gap={2} marginTop={1}>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="white"
                paddingX={1}
              >
                <Text color="white">width=30</Text>
                <MaxSizedBox
                  maxWidth={30}
                  maxHeight={6}
                  overflowDirection="bottom"
                >
                  {basicRows}
                </MaxSizedBox>
              </Box>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="white"
                paddingX={1}
              >
                <Text color="white">width=45</Text>
                <MaxSizedBox
                  maxWidth={45}
                  maxHeight={6}
                  overflowDirection="bottom"
                >
                  {basicRows}
                </MaxSizedBox>
              </Box>
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="white"
                paddingX={1}
              >
                <Text color="white">width=60</Text>
                <MaxSizedBox
                  maxWidth={60}
                  maxHeight={6}
                  overflowDirection="bottom"
                >
                  {basicRows}
                </MaxSizedBox>
              </Box>
            </Box>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <OverflowProvider>
      <Box flexDirection="column" gap={1}>
        <Text color="green" bold>
          MaxSizedBox Demo
        </Text>
        <Text color="gray">
          Section {currentSection}/{SECTION_COUNT}
        </Text>

        {renderSection()}

        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">Controls:</Text>
          <Text color="gray">{'  '}↑ ↓ or 1-6 Switch section | Q/Esc Exit</Text>
        </Box>
      </Box>
    </OverflowProvider>
  );
}

export async function main() {
  await new Promise<void>((resolve) => {
    const { unmount } = render(
      <KeypressProvider>
        <Demo onExit={() => unmount()} />
      </KeypressProvider>,
    );

    // Set a maximum timeout as fallback
    setTimeout(() => {
      unmount();
      resolve();
    }, 300000); // 5 minutes max
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
