/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useIsScreenReaderEnabled } from 'ink';
import { useUIState } from './contexts/ui-state-context.js';
import { StreamingContext } from './contexts/streaming-context.js';
import { QuittingDisplay } from './components/indicators/quitting-display.js';
import { ScreenReaderAppLayout } from './components/layout/screen-reader-app-layout.js';
import { DefaultAppLayout } from './components/layout/default-app-layout.js';
import { AlternateBufferQuittingDisplay } from './components/indicators/alternate-buffer-quitting-display.js';
import { useAlternateBuffer } from './hooks/terminal/use-alternate-buffer.js';

export const App = () => {
  const uiState = useUIState();
  const isAlternateBuffer = useAlternateBuffer();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();

  if (uiState.quittingMessages) {
    if (isAlternateBuffer) {
      return (
        <StreamingContext.Provider value={uiState.streamingState}>
          <AlternateBufferQuittingDisplay />
        </StreamingContext.Provider>
      );
    } else {
      return <QuittingDisplay />;
    }
  }

  return (
    <StreamingContext.Provider value={uiState.streamingState}>
      {isScreenReaderEnabled ? <ScreenReaderAppLayout /> : <DefaultAppLayout />}
    </StreamingContext.Provider>
  );
};
