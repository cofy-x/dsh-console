/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { Header } from './header.js';
import { useSettings } from '../../contexts/settings-context.js';
import { useConfig } from '../../contexts/config-context.js';
import { useUIState } from '../../contexts/ui-state-context.js';
import {
  loadHeaderArt,
  loadCustomAsciiArt,
} from '../../../utils/header-loader.js';
import { useMemo } from 'react';

interface AppHeaderProps {
  version: string;
}

export const AppHeader = ({ version }: AppHeaderProps) => {
  const settings = useSettings();
  const config = useConfig();

  const { nightly, terminalWidth } = useUIState();
  // Read header settings
  const headerLayout =
    (settings.merged.ui.header.layout) ?? 'horizontal';
  const artResourceType =
    (settings.merged.ui.header.artResourceType) ??
    'pokemon';
  const artResourcesPath = settings.merged.ui.header.artResourcesPath;
  const customAsciiArtPath = settings.merged.ui.header.customAsciiArtPath;
  const pokemonNumber = config.getPokemonNumber();

  // Load custom ASCII art if path is configured (overrides other settings)
  const customAsciiArt = useMemo(() => {
    if (pokemonNumber === undefined && customAsciiArtPath) {
      return loadCustomAsciiArt(customAsciiArtPath);
    }
    return undefined;
  }, [customAsciiArtPath, pokemonNumber]);

  // Resolve the selected art once for either responsive layout.
  const headerArt = useMemo(() => {
    if (customAsciiArt) {
      return null;
    }
    if (pokemonNumber !== undefined) {
      return loadHeaderArt('pokemon', undefined, pokemonNumber);
    }
    return loadHeaderArt(artResourceType, artResourcesPath);
  }, [artResourceType, artResourcesPath, customAsciiArt, pokemonNumber]);

  if (config.getScreenReader()) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Header
        nightly={nightly}
        version={version}
        layout={headerLayout}
        terminalWidth={terminalWidth}
        headerArt={headerArt}
        hideTips={!!settings.merged.ui?.hideTips}
        customAsciiArt={customAsciiArt}
      />
    </Box>
  );
};
