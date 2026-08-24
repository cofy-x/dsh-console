/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export class FatalConfigError extends Error {
  readonly exitCode = 52;
}
