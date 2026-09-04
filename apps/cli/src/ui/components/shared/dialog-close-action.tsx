/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import type React from 'react';
import { MOUSE_EVENT_PRIORITY } from '../../contexts/mouse-context.js';
import { theme } from '../../theme/colors.js';
import { InteractiveRegion } from './interactive-region.js';

export interface DialogCloseActionProps {
  onClose: () => void;
  isActive?: boolean;
  label?: string;
}

export function DialogCloseAction({
  onClose,
  isActive = true,
  label = 'Esc to close',
}: DialogCloseActionProps): React.JSX.Element {
  return (
    <InteractiveRegion
      onPress={onClose}
      isActive={isActive}
      mousePriority={MOUSE_EVENT_PRIORITY.dialog}
    >
      <Text
        color={isActive ? theme.text.link : theme.text.secondary}
        underline={isActive}
      >
        {label}
      </Text>
    </InteractiveRegion>
  );
}
