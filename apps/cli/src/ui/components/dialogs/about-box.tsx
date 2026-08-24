/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { GIT_COMMIT_INFO } from '../../../generated/git-commit.js';

interface AboutBoxProps {
  cliVersion: string;
  osVersion: string;
  modelVersion: string;
}

export const AboutBox: React.FC<AboutBoxProps> = ({
  cliVersion,
  osVersion,
  modelVersion,
}) => (
  <Box
    borderStyle="round"
    borderColor={theme.border.default}
    flexDirection="column"
    padding={1}
    marginY={1}
    width="100%"
  >
    <Box marginBottom={1}>
      <Text bold color={theme.text.accent}>
        About DSH Console
      </Text>
    </Box>
    <Box flexDirection="row">
      <Box width="35%">
        <Text bold color={theme.text.link}>
          CLI Version
        </Text>
      </Box>
      <Box>
        <Text color={theme.text.primary}>{cliVersion}</Text>
      </Box>
    </Box>
    {GIT_COMMIT_INFO && !['N/A'].includes(GIT_COMMIT_INFO) && (
      <Box flexDirection="row">
        <Box width="35%">
          <Text bold color={theme.text.link}>
            Git Commit
          </Text>
        </Box>
        <Box>
          <Text color={theme.text.primary}>{GIT_COMMIT_INFO}</Text>
        </Box>
      </Box>
    )}
    <Box flexDirection="row">
      <Box width="35%">
        <Text bold color={theme.text.link}>
          Model
        </Text>
      </Box>
      <Box>
        <Text color={theme.text.primary}>{modelVersion}</Text>
      </Box>
    </Box>
    <Box flexDirection="row">
      <Box width="35%">
        <Text bold color={theme.text.link}>
          OS
        </Text>
      </Box>
      <Box>
        <Text color={theme.text.primary}>{osVersion}</Text>
      </Box>
    </Box>
  </Box>
);
