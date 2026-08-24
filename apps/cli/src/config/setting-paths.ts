/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Common setting paths for type-safe access to settings.
 *
 * This provides a centralized location for commonly used setting paths,
 * reducing magic strings throughout the codebase.
 */
export const SettingPaths = {
  General: {
    PreferredEditor: 'general.preferredEditor',
  },
} as const;
