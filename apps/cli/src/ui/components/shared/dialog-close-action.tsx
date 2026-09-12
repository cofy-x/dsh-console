/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import type React from 'react';
import { MOUSE_EVENT_PRIORITY } from '../../contexts/mouse-context.js';
import { useKeypress } from '../../hooks/input/use-keypress.js';
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
  label = 'Esc/Ctrl+C to close',
}: DialogCloseActionProps): React.JSX.Element {
  useKeypress(
    (key) => {
      if (key.ctrl && key.name === 'c') onClose();
    },
    { isActive },
  );

  return (
    <InteractiveRegion
      onPress={onClose}
      isActive={isActive}
      mousePriority={MOUSE_EVENT_PRIORITY.dialog}
    >
      {({ hovered }) => (
        <Text
          color={
            isActive
              ? hovered
                ? theme.text.accent
                : theme.text.link
              : theme.text.secondary
          }
          bold={isActive && hovered}
          underline={isActive}
        >
          {label}
        </Text>
      )}
    </InteractiveRegion>
  );
}
