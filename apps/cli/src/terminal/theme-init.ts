/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type TerminalBackgroundColor,
  terminalCapabilityManager,
} from './capabilities.js';
import { themeManager, DEFAULT_THEME } from '../ui/theme/manager.js';
import { pickDefaultThemeName } from '../ui/theme/core.js';
import { getThemeTypeFromBackgroundColor } from '../ui/theme/utils.js';
import type { LoadedSettings } from '../config/user-settings.js';
import { coreEvents, debugLogger } from '@cofy-x/dsh-console-core';
import type { Config } from '../config/config.js';

/**
 * Detects terminal capabilities, loads themes, and sets the active theme.
 * @param config The application config.
 * @param settings The loaded settings.
 * @returns The detected terminal background color.
 */
export async function setupTerminalAndTheme(
  config: Config,
  settings: LoadedSettings,
): Promise<TerminalBackgroundColor> {
  let terminalBackground: TerminalBackgroundColor = undefined;
  if (config.isInteractive() && process.stdin.isTTY) {
    // Detect terminal capabilities (Kitty protocol, background color) in parallel.
    await terminalCapabilityManager.detectCapabilities();
    terminalBackground = terminalCapabilityManager.getTerminalBackgroundColor();
  }

  // Load custom themes from settings
  themeManager.loadCustomThemes(settings.merged.ui.customThemes);

  if (settings.merged.ui.theme) {
    if (!themeManager.setActiveTheme(settings.merged.ui.theme)) {
      // If the theme is not found during initial load, log a warning and continue.
      // The useThemeCommand hook in AppContainer.tsx will handle opening the dialog.
      debugLogger.warn(
        `Warning: Theme "${settings.merged.ui.theme}" not found.`,
      );
    }
  } else {
    // If no theme is set, check terminal background color
    const themeName = pickDefaultThemeName(
      terminalBackground,
      themeManager.getAllThemes(),
      DEFAULT_THEME.name,
      'Default Light',
    );
    themeManager.setActiveTheme(themeName);
  }

  config.setTerminalBackground(terminalBackground);

  if (terminalBackground !== undefined) {
    const currentTheme = themeManager.getActiveTheme();
    if (currentTheme.type !== 'ansi' && currentTheme.type !== 'custom') {
      const backgroundType =
        getThemeTypeFromBackgroundColor(terminalBackground);
      if (backgroundType && currentTheme.type !== backgroundType) {
        coreEvents.emitFeedback(
          'warning',
          `Theme '${currentTheme.name}' (${currentTheme.type}) might look incorrect on your ${backgroundType} terminal background. Type /theme to change theme.`,
        );
      }
    }
  }

  return terminalBackground;
}
