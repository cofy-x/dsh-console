/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { useMemo } from 'react';
import { RadioButtonSelect } from '../shared/radio-button-select.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
import { theme } from '../../theme/colors.js';
import type {
  ApprovalRequestView,
  ApprovalResponse,
} from '../../approval-runtime.js';

export const ToolConfirmationMessage: React.FC<{
  request: ApprovalRequestView;
  respond: (response: ApprovalResponse) => void;
  isFocused: boolean;
}> = ({ request, respond, isFocused }) => {
  useKeypress(
    (key) => {
      if (
        isFocused &&
        (key.name === 'escape' || (key.ctrl && key.name === 'c'))
      ) {
        respond('cancelled');
      }
    },
    { isActive: isFocused },
  );

  const options = useMemo(
    () => [
      {
        label: 'Allow once',
        value: 'allowed-once' as const,
        key: 'allow-once',
      },
      { label: 'Reject', value: 'rejected' as const, key: 'reject' },
    ],
    [],
  );

  return (
    <Box flexDirection="column" paddingBottom={1}>
      {request.reason !== undefined && (
        <Box marginBottom={1}>
          <Text color={theme.text.secondary}>{request.reason}</Text>
        </Box>
      )}
      <Box marginBottom={1}>
        <Text color={theme.text.primary}>
          Allow <Text bold>{request.toolName}</Text> to continue?
        </Text>
      </Box>
      <RadioButtonSelect
        items={options}
        onSelect={respond}
        isFocused={isFocused}
      />
      <Text color={theme.text.secondary}>Esc cancels this request</Text>
    </Box>
  );
};
