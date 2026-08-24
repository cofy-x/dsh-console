/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLayoutEffect } from 'react';

let sensitiveInputDepth = 0;

export function isSensitiveInputActive(): boolean {
  return sensitiveInputDepth > 0;
}

export function useSensitiveInputProtection(): void {
  useLayoutEffect(() => {
    sensitiveInputDepth += 1;
    return () => {
      sensitiveInputDepth = Math.max(0, sensitiveInputDepth - 1);
    };
  }, []);
}
