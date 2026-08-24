/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FileFilteringOptions {
  respectGitIgnore: boolean;
  respectDshConsoleIgnore: boolean;
  maxFileCount?: number;
  searchTimeout?: number;
}

// For all other files
export const DEFAULT_FILE_FILTERING_OPTIONS: FileFilteringOptions = {
  respectGitIgnore: true,
  respectDshConsoleIgnore: true,
  maxFileCount: 20000,
  searchTimeout: 5000,
};
