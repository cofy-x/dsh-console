/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';

export const Tips: React.FC = () => (
  <Box flexDirection="column" marginTop={0}>
    <Text color="gray">Tips:</Text>
    <Box paddingTop={1} paddingLeft={1} flexDirection="column">
      <Text color={theme.text.primary}>1. Ask questions or run commands.</Text>
      <Text color={theme.text.primary}>
        2.{' '}
        <Text bold color={theme.text.accent}>
          /help
        </Text>{' '}
        for more.
      </Text>
    </Box>
  </Box>
);
