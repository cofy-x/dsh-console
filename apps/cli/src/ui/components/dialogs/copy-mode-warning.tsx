/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { useUIState } from '../../contexts/ui-state-context.js';
import { theme } from '../../theme/colors.js';

export const CopyModeWarning: React.FC = () => {
  const { copyModeEnabled } = useUIState();

  if (!copyModeEnabled) {
    return null;
  }

  return (
    <Box>
      <Text color={theme.status.warning}>
        In Copy Mode. Press any key to exit.
      </Text>
    </Box>
  );
};
