/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Configuration type definitions for the CLI.
 *
 * This module contains all the type definitions used by the Config class
 * and configuration loading system.
 */

import type { ShellExecutionConfig } from '@cofy-x/dsh-console-core';

/**
 * Accessibility-related settings for the CLI.
 */
export interface AccessibilitySettings {
  /**
   * Whether to enable loading phrases during operations.
   */
  enableLoadingPhrases?: boolean;

  /**
   * Whether screen reader mode is enabled.
   */
  screenReader?: boolean;
}

/**
 * File filtering configuration.
 */
export interface FileFilteringSettings {
  /**
   * Whether to respect .gitignore files.
   */
  respectGitIgnore?: boolean;

  /**
   * Whether to respect .dsh-consoleignore files.
   */
  respectDshConsoleIgnore?: boolean;

  /**
   * Whether to enable recursive file search.
   */
  enableRecursiveFileSearch?: boolean;

  /**
   * Whether to disable fuzzy search.
   */
  enableFuzzySearch?: boolean;

  /**
   * The maximum number of files to search.
   */
  maxFileCount?: number;

  /**
   * The search timeout in milliseconds.
   */
  searchTimeout?: number;
}

/**
 * Parameters for creating a Config instance.
 *
 * This interface contains all the configuration values that can be passed
 * when constructing a new Config object.
 */
export interface ConfigParameters {
  // Local UI diagnostics correlation; not a DSH Session ID.

  // Execution environment
  targetDir: string;
  debugMode: boolean;

  // Initial question/prompt
  question?: string;

  // One-time startup presentation
  pokemonNumber?: number;

  // Environment sanitization
  allowedEnvironmentVariables?: string[];
  blockedEnvironmentVariables?: string[];
  enableEnvironmentVariableRedaction?: boolean;

  // UI settings
  accessibility?: AccessibilitySettings;
  useBackgroundColor?: boolean;

  // File handling
  fileFiltering?: FileFilteringSettings;

  // Network
  proxy?: string;

  // Interactive mode
  interactive?: boolean;

  // Shell configuration
  enableInteractiveShell?: boolean;
  shellExecutionConfig?: ShellExecutionConfig;

  // Prompt completion
  enablePromptCompletion?: boolean;

  // PTY info
  ptyInfo?: string;
}
