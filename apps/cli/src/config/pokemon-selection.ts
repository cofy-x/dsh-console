/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export const POKEMON_NUMBER_ENV = 'DSH_CONSOLE_POKEMON';

function parsePokemonNumber(raw: string, source: string): number {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    throw new Error(`${source} must be a positive integer.`);
  }

  const pokemonNumber = Number(value);
  if (!Number.isSafeInteger(pokemonNumber) || pokemonNumber < 1) {
    throw new Error(`${source} must be a positive integer.`);
  }
  return pokemonNumber;
}

/** Resolves the one-time header override without persisting it to settings. */
export function resolvePokemonNumber(
  cliValue: string | undefined,
  envValue: string | undefined,
): number | undefined {
  if (cliValue !== undefined) {
    return parsePokemonNumber(cliValue, '--pokemon');
  }
  if (envValue !== undefined) {
    return parsePokemonNumber(envValue, POKEMON_NUMBER_ENV);
  }
  return undefined;
}
