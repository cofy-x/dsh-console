/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MarkdownDisplay Demo
 *
 * This demo showcases the MarkdownDisplay component features:
 * - Headers (h1-h4)
 * - Code blocks with syntax highlighting
 * - Lists (ordered and unordered)
 * - Inline formatting (bold, italic, code)
 * - Tables
 * - Raw markdown mode
 *
 * Controls:
 *   Space or M - Toggle between rendered and raw markdown mode
 *   Q or Escape - Exit
 *
 * Usage (from apps/cli directory):
 *   pnpm run example examples/src/component/markdown-display.tsx
 */

import { render, Box, Text, useStdout } from 'ink';
import { useState, useCallback } from 'react';
import { MarkdownDisplay } from '../../../src/ui/components/markdown/markdown-display.js';
import { SettingsContext } from '../../../src/ui/contexts/settings-context.js';
import { KeypressProvider } from '../../../src/ui/contexts/keypress-context.js';
import type { Key } from '../../../src/terminal/keys.js';
import { useKeypress } from '../../../src/ui/hooks/input/use-keypress.js';
import type { LoadedSettings } from '../../../src/config/user-settings.js';

// Create a minimal mock settings for the demo
const mockSettings = {
  merged: {
    ui: {
      showLineNumbers: true,
      alternateBuffer: false,
    },
  },
} as unknown as LoadedSettings;

// Sample markdown content demonstrating various features
const DEMO_MARKDOWN = `# Welcome to MarkdownDisplay Demo

This component renders **markdown** content with _styling_ and \`inline code\`.

## Code Blocks

Here's a TypeScript example:

\`\`\`typescript
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
\`\`\`

## Lists

### Unordered List
- First item with **bold** text
- Second item with \`code\`
- Third item
  - Nested item

### Ordered List
1. Step one
2. Step two
3. Step three

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Headers | Done | h1-h4 supported |
| Code | Done | Syntax highlighting |
| Lists | Done | Nested supported |

## Horizontal Rule

---

### Level 4 Header

This is a paragraph with mixed formatting: **bold**, *italic*, and \`code\`.

> Note: Blockquotes are rendered as regular text.
`;

const RAW_MARKDOWN_SAMPLE = `# Raw Markdown Mode

This shows the **raw markdown syntax** without rendering.

\`\`\`javascript
console.log("Hello World");
\`\`\`

## Features shown in raw mode:
- Headers use # prefix
- **Bold** uses double asterisks
- \`Code\` uses backticks
- Lists use - or numbers
`;

interface DemoProps {
  onExit: () => void;
}

function Demo({ onExit }: DemoProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;
  const [showRaw, setShowRaw] = useState(false);

  const handleKeypress = useCallback(
    (key: Key) => {
      if (key.name === 'q' || key.name === 'escape') {
        onExit();
      } else if (key.name === 'space' || key.name === 'm') {
        setShowRaw((prev) => !prev);
      }
    },
    [onExit],
  );

  useKeypress(handleKeypress, { isActive: true });

  return (
    <SettingsContext.Provider value={mockSettings}>
      <Box flexDirection="column" gap={1}>
        <Text color="green" bold>
          MarkdownDisplay Demo
        </Text>
        <Text color="gray">
          Terminal: {terminalWidth}x{terminalHeight} | Mode:{' '}
          <Text color={showRaw ? 'yellow' : 'cyan'}>
            {showRaw ? 'Raw Markdown' : 'Rendered'}
          </Text>
        </Text>

        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={showRaw ? 'yellow' : 'cyan'}
          paddingX={1}
        >
          <MarkdownDisplay
            text={showRaw ? RAW_MARKDOWN_SAMPLE : DEMO_MARKDOWN}
            isPending={false}
            terminalWidth={terminalWidth - 4}
            availableTerminalHeight={terminalHeight - 8}
            renderMarkdown={!showRaw}
          />
        </Box>

        <Box flexDirection="column">
          <Text color="yellow">Controls:</Text>
          <Text color="gray">{'  '}Space/M Toggle mode | Q/Esc Exit</Text>
        </Box>
      </Box>
    </SettingsContext.Provider>
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
