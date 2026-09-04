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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AppHeaderProps {
  version: string;
  showStartupActions?: boolean;
}

export const AppHeader = ({
  version,
  showStartupActions = false,
}: AppHeaderProps) => {
  const settings = useSettings();
  const config = useConfig();

  const { nightly, terminalWidth } = useUIState();
  // Read header settings
  const headerLayout = settings.merged.ui.header.layout ?? 'horizontal';
  const artResourceType =
    settings.merged.ui.header.artResourceType ?? 'pokemon';
  const artResourcesPath = settings.merged.ui.header.artResourcesPath;
  const customAsciiArtPath = settings.merged.ui.header.customAsciiArtPath;
  const pokemonNumber = config.getPokemonNumber();
  const [artRevision, setArtRevision] = useState(0);
  const previousHeaderArtIdRef = useRef<string | undefined>(undefined);

  // Load custom ASCII art if path is configured (overrides other settings)
  const customAsciiArt = useMemo(() => {
    if (pokemonNumber === undefined && customAsciiArtPath) {
      return loadCustomAsciiArt(customAsciiArtPath);
    }
    return undefined;
  }, [customAsciiArtPath, pokemonNumber]);

  // Resolve the selected art once for either responsive layout.
  const headerArt = useMemo(() => {
    if (customAsciiArt) return null;
    if (pokemonNumber !== undefined) {
      return loadHeaderArt('pokemon', undefined, pokemonNumber);
    }
    return loadHeaderArt(artResourceType, artResourcesPath, undefined, {
      excludedId:
        artRevision === 0 ? undefined : previousHeaderArtIdRef.current,
      maxWidth: artResourceType === 'pokemon' ? terminalWidth : undefined,
    });
  }, [
    artResourceType,
    artResourcesPath,
    customAsciiArt,
    pokemonNumber,
    artRevision,
    terminalWidth,
  ]);
  useEffect(() => {
    previousHeaderArtIdRef.current = headerArt?.id;
  }, [headerArt]);
  const canShufflePokemon =
    artResourceType === 'pokemon' &&
    customAsciiArt === undefined &&
    pokemonNumber === undefined;
  const handleShufflePokemon = useCallback(() => {
    setArtRevision((revision) => revision + 1);
  }, []);

  if (config.getScreenReader()) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Header
        nightly={nightly}
        version={version}
        showVersion={config.getDebugMode()}
        layout={headerLayout}
        terminalWidth={terminalWidth}
        headerArt={headerArt}
        hideTips={!!settings.merged.ui?.hideTips}
        customAsciiArt={customAsciiArt}
        showStartupActions={showStartupActions}
        onShufflePokemon={canShufflePokemon ? handleShufflePokemon : undefined}
      />
    </Box>
  );
};
