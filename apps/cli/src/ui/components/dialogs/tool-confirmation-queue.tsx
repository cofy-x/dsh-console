/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme/colors.js';
import { ToolConfirmationMessage } from '../messages/tool-confirmation-message.js';
import type {
  ApprovalRequestView,
  ApprovalResponse,
} from '../../approval-runtime.js';

export const ToolConfirmationQueue: React.FC<{
  request: ApprovalRequestView;
  index: number;
  total: number;
  terminalWidth: number;
  respond: (response: ApprovalResponse) => void;
}> = ({ request, index, total, terminalWidth, respond }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor={theme.status.warning}
    paddingX={1}
    width={terminalWidth}
    flexShrink={0}
  >
    <Box marginBottom={1} justifyContent="space-between">
      <Text color={theme.status.warning} bold>
        Action Required
      </Text>
      <Text color={theme.text.secondary}>
        {index} of {total}
      </Text>
    </Box>
    <Box marginBottom={1} flexDirection="column">
      <Text color={theme.text.primary} bold>
        {request.toolName}
      </Text>
      {request.callId !== undefined && (
        <Text color={theme.text.secondary}>Call {request.callId}</Text>
      )}
    </Box>
    <ToolConfirmationMessage
      request={request}
      respond={respond}
      isFocused={true}
    />
  </Box>
);
