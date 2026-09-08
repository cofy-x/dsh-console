/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InteractionModeKind } from '../../interaction-mode-runtime.js';
import { theme } from '../../theme/colors.js';
import { themeManager } from '../../theme/manager.js';

export const interactionModeColor = (
  kind: InteractionModeKind,
): string | undefined => {
  switch (kind) {
    case 'plan':
      return themeManager.getActiveTheme().colors.AccentCyan;
    case 'full-access':
      return theme.status.error;
    case 'permission':
      return theme.status.warning;
    default:
      return undefined;
  }
};

export const interactionModeLabel = (
  kind: InteractionModeKind,
  label: string,
): string => (kind === 'default' || kind === 'plan' ? `${label} mode` : label);
