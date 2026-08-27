/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview CLI Configuration class.
 *
 * This module contains the Config class for Console-owned presentation,
 * terminal, workspace, and process capabilities.
 */

import path from 'node:path';
import {
  type ShellExecutionConfig,
  type FileFilteringOptions,
  Storage,
  DEFAULT_FILE_FILTERING_OPTIONS,
  setGlobalProxy,
  coreEvents,
  type EnvironmentSanitizationConfig,
} from '@cofy-x/dsh-console-core';
import { type ConfigParameters, type AccessibilitySettings } from './types.js';

const DEFAULT_SHELL_TERMINAL_WIDTH = 80;
const DEFAULT_SHELL_TERMINAL_HEIGHT = 24;

/**
 * CLI Configuration class.
 *
 * Holds CLI presentation, terminal, workspace, and process configuration.
 * Conversation state and model execution remain owned by injected DSH runtimes.
 */
export class Config {
  private terminalBackground: string | undefined = undefined;

  // Configuration values (readonly after construction)
  private readonly targetDir: string;
  private readonly debugMode: boolean;
  private readonly question: string | undefined;
  private readonly pokemonNumber: number | undefined;

  // Environment sanitization
  private readonly allowedEnvironmentVariables: string[];
  private readonly blockedEnvironmentVariables: string[];
  private readonly enableEnvironmentVariableRedaction: boolean;

  // UI settings
  private readonly accessibility: AccessibilitySettings;

  // File handling
  private readonly fileFiltering: {
    respectGitIgnore: boolean;
    respectDshConsoleIgnore: boolean;
    enableRecursiveFileSearch: boolean;
    enableFuzzySearch: boolean;
    maxFileCount: number;
    searchTimeout: number;
  };
  private readonly useBackgroundColor: boolean;

  // Interactive mode
  private readonly interactive: boolean;
  private readonly ptyInfo: string;

  // Shell configuration
  private readonly enableInteractiveShell: boolean;
  private shellExecutionConfig: ShellExecutionConfig;

  // Prompt completion
  private readonly enablePromptCompletion: boolean = false;

  // Storage
  readonly storage: Storage;

  constructor(params: ConfigParameters) {
    this.targetDir = path.resolve(params.targetDir);
    this.debugMode = params.debugMode;
    this.question = params.question;
    this.pokemonNumber = params.pokemonNumber;

    this.allowedEnvironmentVariables = params.allowedEnvironmentVariables ?? [];
    this.blockedEnvironmentVariables = params.blockedEnvironmentVariables ?? [];
    this.enableEnvironmentVariableRedaction =
      params.enableEnvironmentVariableRedaction ?? true;
    this.accessibility = params.accessibility ?? {};

    this.fileFiltering = {
      respectGitIgnore:
        params.fileFiltering?.respectGitIgnore ??
        DEFAULT_FILE_FILTERING_OPTIONS.respectGitIgnore,
      respectDshConsoleIgnore:
        params.fileFiltering?.respectDshConsoleIgnore ??
        DEFAULT_FILE_FILTERING_OPTIONS.respectDshConsoleIgnore,
      enableRecursiveFileSearch:
        params.fileFiltering?.enableRecursiveFileSearch ?? true,
      enableFuzzySearch: params.fileFiltering?.enableFuzzySearch ?? true,
      maxFileCount:
        params.fileFiltering?.maxFileCount ??
        DEFAULT_FILE_FILTERING_OPTIONS.maxFileCount ??
        20000,
      searchTimeout:
        params.fileFiltering?.searchTimeout ??
        DEFAULT_FILE_FILTERING_OPTIONS.searchTimeout ??
        5000,
    };
    this.interactive = params.interactive ?? false;
    this.ptyInfo = params.ptyInfo ?? 'child_process';
    this.useBackgroundColor = params.useBackgroundColor ?? true;
    this.enableInteractiveShell = params.enableInteractiveShell ?? false;
    this.shellExecutionConfig = {
      terminalWidth:
        params.shellExecutionConfig?.terminalWidth ??
        DEFAULT_SHELL_TERMINAL_WIDTH,
      terminalHeight:
        params.shellExecutionConfig?.terminalHeight ??
        DEFAULT_SHELL_TERMINAL_HEIGHT,
      showColor: params.shellExecutionConfig?.showColor ?? false,
      pager: params.shellExecutionConfig?.pager ?? 'cat',
      sanitizationConfig: this.sanitizationConfig,
    };
    this.storage = new Storage(this.targetDir);
    this.enablePromptCompletion = params.enablePromptCompletion ?? false;
    const proxy = params.proxy;
    if (proxy) {
      try {
        setGlobalProxy(proxy);
      } catch (error) {
        coreEvents.emitFeedback(
          'error',
          'Invalid proxy configuration detected. Check debug drawer for more details (F12)',
          error,
        );
      }
    }
  }

  setTerminalBackground(terminalBackground: string | undefined): void {
    this.terminalBackground = terminalBackground;
  }

  getTerminalBackground(): string | undefined {
    return this.terminalBackground;
  }

  getTargetDir(): string {
    return this.targetDir;
  }

  getProjectRoot(): string {
    return this.targetDir;
  }

  getDebugMode(): boolean {
    return this.debugMode;
  }

  getQuestion(): string | undefined {
    return this.question;
  }

  getPokemonNumber(): number | undefined {
    return this.pokemonNumber;
  }

  get sanitizationConfig(): EnvironmentSanitizationConfig {
    return {
      allowedEnvironmentVariables: this.allowedEnvironmentVariables,
      blockedEnvironmentVariables: this.blockedEnvironmentVariables,
      enableEnvironmentVariableRedaction:
        this.enableEnvironmentVariableRedaction,
    };
  }

  getAccessibility(): AccessibilitySettings {
    return this.accessibility;
  }

  getScreenReader(): boolean {
    return this.accessibility.screenReader ?? false;
  }

  getEnableRecursiveFileSearch(): boolean {
    return this.fileFiltering.enableRecursiveFileSearch;
  }

  getFileFilteringEnableFuzzySearch(): boolean {
    return this.fileFiltering.enableFuzzySearch;
  }

  getFileFilteringOptions(): FileFilteringOptions {
    return {
      respectGitIgnore: this.fileFiltering.respectGitIgnore,
      respectDshConsoleIgnore: this.fileFiltering.respectDshConsoleIgnore,
      maxFileCount: this.fileFiltering.maxFileCount,
      searchTimeout: this.fileFiltering.searchTimeout,
    };
  }

  isInteractive(): boolean {
    return this.interactive;
  }

  isInteractiveShellEnabled(): boolean {
    return (
      this.interactive &&
      this.ptyInfo !== 'child_process' &&
      this.enableInteractiveShell
    );
  }

  getUseBackgroundColor(): boolean {
    return this.useBackgroundColor;
  }

  getEnableInteractiveShell(): boolean {
    return this.enableInteractiveShell;
  }

  getShellExecutionConfig(): ShellExecutionConfig {
    return this.shellExecutionConfig;
  }

  setShellExecutionConfig(config: ShellExecutionConfig): void {
    this.shellExecutionConfig = {
      terminalWidth:
        config.terminalWidth ?? this.shellExecutionConfig.terminalWidth,
      terminalHeight:
        config.terminalHeight ?? this.shellExecutionConfig.terminalHeight,
      showColor: config.showColor ?? this.shellExecutionConfig.showColor,
      pager: config.pager ?? this.shellExecutionConfig.pager,
      sanitizationConfig:
        config.sanitizationConfig ??
        this.shellExecutionConfig.sanitizationConfig,
    };
  }

  getEnablePromptCompletion(): boolean {
    return this.enablePromptCompletion;
  }
}
