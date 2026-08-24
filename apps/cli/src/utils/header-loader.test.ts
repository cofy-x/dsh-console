/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getAsciiArtWidth } from '../text/processing.js';
import { loadHeaderArt } from './header-loader.js';

describe('loadHeaderArt', () => {
  it('loads bundled Pokemon art by default', () => {
    const art = loadHeaderArt();

    expect(art).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        art: expect.any(String),
      }),
    );
    expect(getAsciiArtWidth(art?.art ?? '')).toBeGreaterThan(0);
  });

  it('requires a path for custom resource directories', () => {
    expect(loadHeaderArt('custom')).toBeNull();
  });
});
