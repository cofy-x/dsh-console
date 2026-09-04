/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debugLogger } from '@cofy-x/dsh-console-core';
import fs from 'node:fs';
import path from 'node:path';
import { getAsciiArtWidth } from '../text/processing.js';
import { findPackageRoot } from './package-root.js';

/**
 * Base directory for bundled header art resources.
 * Located relative to this file at: ../ui/components/layout/resources
 */
const packageRoot = findPackageRoot(import.meta.url);
const builtResources = path.join(
  packageRoot,
  'dist/ui/components/layout/resources',
);
const sourceResources = path.join(
  packageRoot,
  'src/ui/components/layout/resources',
);

/**
 * Supported bundled resource types.
 * Each type corresponds to a subdirectory under the resources folder.
 */
export type HeaderArtResourceType = 'pokemon' | 'custom';

export interface HeaderArt {
  id: string;
  art: string;
}

export class PokemonHeaderArtNotFoundError extends Error {
  constructor(pokemonNumber: number) {
    super(`Bundled Pokemon #${pokemonNumber} is not available.`);
    this.name = 'PokemonHeaderArtNotFoundError';
  }
}

/**
 * Resolves the resources directory path for a given resource type.
 * @param resourceType The type of art resources to load
 * @param customPath Optional custom path (used when resourceType is 'custom')
 * @returns The resolved directory path
 */
function resolveResourcesDir(
  resourceType: HeaderArtResourceType,
  customPath?: string,
): string | null {
  if (resourceType === 'custom') {
    if (!customPath) {
      return null;
    }
    return path.resolve(process.cwd(), customPath);
  }

  // Pokemon packs may live outside the npm package.
  if (resourceType === 'pokemon' && customPath) {
    return path.resolve(process.cwd(), customPath);
  }

  const builtResourceDir = path.join(builtResources, resourceType);
  return fs.existsSync(builtResourceDir)
    ? builtResourceDir
    : path.join(sourceResources, resourceType);
}

/**
 * Loads a random header ASCII art from the specified resource type directory.
 * @param resourceType The type of art resources to load ('pokemon', 'custom', etc.)
 * @param customPath Optional custom or external Pokemon resource directory
 * @returns HeaderArt object or null if no art is available
 */
export interface HeaderArtSelectionOptions {
  excludedId?: string;
  maxWidth?: number;
}

export function loadHeaderArt(
  resourceType: HeaderArtResourceType = 'pokemon',
  customPath?: string,
  pokemonNumber?: number,
  options: HeaderArtSelectionOptions = {},
): HeaderArt | null {
  try {
    const resourcesDir = resolveResourcesDir(resourceType, customPath);

    if (!resourcesDir) {
      if (pokemonNumber !== undefined) {
        throw new PokemonHeaderArtNotFoundError(pokemonNumber);
      }
      debugLogger.warn('Custom header art requires an art resources path.');
      return null;
    }

    if (!fs.existsSync(resourcesDir)) {
      if (pokemonNumber !== undefined) {
        throw new PokemonHeaderArtNotFoundError(pokemonNumber);
      }
      debugLogger.warn(`Header art resources path not found: ${resourcesDir}`);
      return null;
    }

    const files = fs
      .readdirSync(resourcesDir)
      .filter((file) => file.endsWith('.txt'))
      .sort();

    if (files.length === 0) {
      if (pokemonNumber !== undefined) {
        throw new PokemonHeaderArtNotFoundError(pokemonNumber);
      }
      return null;
    }

    const randomCandidates =
      options.excludedId !== undefined && files.length > 1
        ? files.filter(
            (file) => file.replace('.txt', '') !== options.excludedId,
          )
        : files;

    let selectedContent: string | undefined;
    const selectRandomCandidate = (): string | undefined => {
      if (randomCandidates.length === 0) return undefined;

      const startIndex = Math.floor(Math.random() * randomCandidates.length);
      for (let offset = 0; offset < randomCandidates.length; offset += 1) {
        const candidate =
          randomCandidates[(startIndex + offset) % randomCandidates.length];
        if (options.maxWidth === undefined) return candidate;

        const content = fs.readFileSync(
          path.join(resourcesDir, candidate),
          'utf-8',
        );
        if (getAsciiArtWidth(content) <= options.maxWidth) {
          selectedContent = content;
          return candidate;
        }
      }
      return undefined;
    };

    const selectedFile =
      pokemonNumber === undefined
        ? selectRandomCandidate()
        : files.find((file) => {
            const match = /^(\d+)(?:-|\.txt$)/.exec(file);
            return (
              match?.[1] !== undefined && Number(match[1]) === pokemonNumber
            );
          });

    if (!selectedFile) {
      if (pokemonNumber !== undefined) {
        throw new PokemonHeaderArtNotFoundError(pokemonNumber);
      }
      return null;
    }

    const content =
      selectedContent ??
      fs.readFileSync(path.join(resourcesDir, selectedFile), 'utf-8');

    const id = selectedFile.replace('.txt', '');

    return {
      id,
      art: content,
    };
  } catch (error: unknown) {
    if (error instanceof PokemonHeaderArtNotFoundError) throw error;
    debugLogger.warn('Error loading header art:', error);
    return null;
  }
}

/**
 * Loads custom ASCII art from a single file path.
 * @param filePath Path to the ASCII art file (relative to CWD or absolute)
 * @returns The ASCII art content or undefined if the file cannot be read
 */
export function loadCustomAsciiArt(filePath: string): string | undefined {
  try {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      debugLogger.warn(`Custom ASCII art file not found: ${resolvedPath}`);
      return undefined;
    }

    return fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error: unknown) {
    debugLogger.warn('Error loading custom ASCII art:', error);
    return undefined;
  }
}
