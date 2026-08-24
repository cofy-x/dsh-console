/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Text, useIsScreenReaderEnabled } from 'ink';
import { CliSpinner, type SpinnerProps } from './cli-spinner.js';
import { useStreamingContext } from '../../contexts/streaming-context.js';
import { StreamingState } from '../../types.js';
import {
  SCREEN_READER_LOADING,
  SCREEN_READER_RESPONDING,
} from '../../accessibility.js';
import { theme } from '../../theme/colors.js';

interface AgentRespondingSpinnerProps {
  /**
   * Optional string to display when not in Responding state.
   * If not provided and not Responding, renders null.
   */
  nonRespondingDisplay?: string;
  spinnerType?: SpinnerProps['type'];
}

export const AgentRespondingSpinner: React.FC<AgentRespondingSpinnerProps> = ({
  nonRespondingDisplay,
  spinnerType = 'dots',
}) => {
  const streamingState = useStreamingContext();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  if (streamingState === StreamingState.Responding) {
    return (
      <AgentSpinner
        spinnerType={spinnerType}
        altText={SCREEN_READER_RESPONDING}
      />
    );
  } else if (nonRespondingDisplay) {
    return isScreenReaderEnabled ? (
      <Text>{SCREEN_READER_LOADING}</Text>
    ) : (
      <Text color={theme.text.primary}>{nonRespondingDisplay}</Text>
    );
  }
  return null;
};

interface AgentSpinnerProps {
  spinnerType?: SpinnerProps['type'];
  altText?: string;
}

export const AgentSpinner: React.FC<AgentSpinnerProps> = ({
  spinnerType = 'dots',
  altText,
}) => {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  return isScreenReaderEnabled ? (
    <Text>{altText}</Text>
  ) : (
    <Text color={theme.text.primary}>
      <CliSpinner type={spinnerType} />
    </Text>
  );
};
