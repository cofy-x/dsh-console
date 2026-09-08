/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';

export const ShellModeIndicator: React.FC = () => (
  <Box paddingX={1}>
    <Text color={theme.status.warning} bold>
      Shell mode
      <Text color={theme.text.secondary}> (Esc to disable)</Text>
    </Text>
  </Box>
);
