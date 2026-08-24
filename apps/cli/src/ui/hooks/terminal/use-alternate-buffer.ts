/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LoadedSettings } from '../../../config/user-settings.js';
import { useSettings } from '../../contexts/settings-context.js';

export const isAlternateBufferEnabled = (settings: LoadedSettings): boolean =>
  settings.merged.ui.useAlternateBuffer === true;

export const useAlternateBuffer = (): boolean => {
  const settings = useSettings();
  return isAlternateBufferEnabled(settings);
};
