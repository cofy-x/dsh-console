/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProxyAgent, setGlobalDispatcher } from 'undici';

export function setGlobalProxy(proxy: string) {
  setGlobalDispatcher(new ProxyAgent(proxy));
}
