/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Limit dsh-console messages to a very high number of lines to mitigate performance
// issues in the worst case if we somehow get an enormous response from dsh-console.
// This threshold is arbitrary but should be high enough to never impact normal
// usage.
export const MAX_AGENT_MESSAGE_LINES = 65536;
