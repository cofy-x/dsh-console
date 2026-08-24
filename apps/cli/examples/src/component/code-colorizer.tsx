/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Code Colorizer Demo
 *
 * This demo showcases the colorizeCode function features:
 * - Syntax highlighting for multiple languages
 * - Line numbers display
 * - Theme-based coloring
 * - Height-constrained code blocks
 *
 * Controls:
 *   Left/Right arrows - Switch between languages
 *   L - Toggle line numbers
 *   Q or Escape - Exit
 *
 * Usage (from apps/cli directory):
 *   pnpm run example examples/src/component/code-colorizer.tsx
 */

import { render, Box, Text, useStdout } from 'ink';
import { useState, useCallback } from 'react';
import { colorizeCode } from '../../../src/ui/components/code/code-colorizer.js';
import { SettingsContext } from '../../../src/ui/contexts/settings-context.js';
import { KeypressProvider } from '../../../src/ui/contexts/keypress-context.js';
import { useKeypress } from '../../../src/ui/hooks/input/use-keypress.js';
import type { LoadedSettings } from '../../../src/config/user-settings.js';
import type { Key } from '../../../src/terminal/keys.js';

// Create a minimal mock settings for the demo
const mockSettings = {
  merged: {
    ui: {
      showLineNumbers: true,
      alternateBuffer: false,
    },
  },
} as unknown as LoadedSettings;

// Sample code snippets for different languages
const CODE_SAMPLES: Array<{ language: string; code: string; title: string }> = [
  {
    language: 'typescript',
    title: 'TypeScript',
    code: `interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);
  const data = await response.json();
  return {
    data,
    status: response.status,
    message: response.ok ? 'Success' : 'Error',
  };
}`,
  },
  {
    language: 'python',
    title: 'Python',
    code: `from dataclasses import dataclass
from typing import List, Optional

@dataclass
class User:
    name: str
    email: str
    age: Optional[int] = None

def process_users(users: List[User]) -> dict:
    """Process a list of users and return statistics."""
    return {
        "total": len(users),
        "with_age": sum(1 for u in users if u.age),
        "names": [u.name for u in users],
    }`,
  },
  {
    language: 'rust',
    title: 'Rust',
    code: `use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Config {
    name: String,
    values: HashMap<String, i32>,
}

impl Config {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            values: HashMap::new(),
        }
    }

    fn set(&mut self, key: &str, value: i32) {
        self.values.insert(key.to_string(), value);
    }
}`,
  },
  {
    language: 'javascript',
    title: 'JavaScript',
    code: `const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Usage example
const handleSearch = debounce((query) => {
  console.log('Searching for:', query);
}, 300);`,
  },
];

interface DemoProps {
  onExit: () => void;
}

function Demo({ onExit }: DemoProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const handleKeypress = useCallback(
    (key: Key) => {
      if (key.name === 'q' || key.name === 'escape') {
        onExit();
      } else if (key.name === 'left') {
        setCurrentIndex(
          (prev) => (prev - 1 + CODE_SAMPLES.length) % CODE_SAMPLES.length,
        );
      } else if (key.name === 'right') {
        setCurrentIndex((prev) => (prev + 1) % CODE_SAMPLES.length);
      } else if (key.name === 'l') {
        setShowLineNumbers((prev) => !prev);
      }
    },
    [onExit],
  );

  useKeypress(handleKeypress, { isActive: true });

  const currentSample = CODE_SAMPLES[currentIndex];
  const maxWidth = Math.min(terminalWidth - 6, 80);
  const availableHeight = Math.min(terminalHeight - 12, 15);

  const settingsWithLineNumbers = {
    merged: {
      ui: {
        showLineNumbers,
        alternateBuffer: false,
      },
    },
  } as unknown as LoadedSettings;

  const colorizedCode = colorizeCode({
    code: currentSample.code,
    language: currentSample.language,
    maxWidth,
    availableHeight,
    settings: settingsWithLineNumbers,
    hideLineNumbers: !showLineNumbers,
  });

  return (
    <SettingsContext.Provider value={mockSettings}>
      <Box flexDirection="column" gap={1}>
        <Text color="green" bold>
          Code Colorizer Demo
        </Text>
        <Text color="gray">
          Terminal: {terminalWidth}x{terminalHeight} | Line Numbers:{' '}
          {showLineNumbers ? 'On' : 'Off'}
        </Text>

        <Box flexDirection="column">
          <Text color="cyan" bold>
            {currentSample.title} ({currentIndex + 1}/{CODE_SAMPLES.length})
          </Text>
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            width={maxWidth + 4}
          >
            {colorizedCode}
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text color="yellow">Controls:</Text>
          <Text color="gray">
            {'  '}← → Switch language | L Toggle line numbers | Q/Esc Exit
          </Text>
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
