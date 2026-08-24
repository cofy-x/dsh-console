/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { AgentSpinner } from '../indicators/agent-responding-spinner.js';
import { theme } from '../../theme/colors.js';

export const CommandInitDisplay = ({
  message = 'Loading commands...',
}: {
  message?: string;
}) => (
    <Box marginTop={1}>
      <Text>
        <AgentSpinner /> <Text color={theme.text.primary}>{message}</Text>
      </Text>
    </Box>
  );
