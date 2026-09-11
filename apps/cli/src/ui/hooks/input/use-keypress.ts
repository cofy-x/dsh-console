/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import {
  useKeypressContext,
  type KeypressHandler,
} from '../../contexts/keypress-context.js';

/**
 * A hook that listens for keypress events from stdin.
 *
 * @param onKeypress - The callback function to execute on each keypress.
 * @param options - Options to control the hook's behavior.
 * @param options.isActive - Whether the hook should be actively listening for input.
 * @param options.isInput - Whether this subscription represents the editable prompt.
 */
export function useKeypress(
  onKeypress: KeypressHandler,
  { isActive, isInput = false }: { isActive: boolean; isInput?: boolean },
) {
  const { registerInputSubscriber, subscribe, unsubscribe } =
    useKeypressContext();

  useEffect(() => {
    if (!isActive) {
      return;
    }

    subscribe(onKeypress);
    const unregisterInputSubscriber = isInput
      ? registerInputSubscriber()
      : undefined;
    return () => {
      unsubscribe(onKeypress);
      unregisterInputSubscriber?.();
    };
  }, [
    isActive,
    isInput,
    onKeypress,
    registerInputSubscriber,
    subscribe,
    unsubscribe,
  ]);
}
