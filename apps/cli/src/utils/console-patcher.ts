/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-console */

import util from 'node:util';
import type { ConsoleLogPayload } from '@cofy-x/dsh-console-core';

interface ConsolePatcherParams {
  onNewMessage: (message: ConsoleLogPayload) => void;
  debugMode: boolean;
}

export class ConsolePatcher {
  private originalConsoleLog = console.log;
  private originalConsoleWarn = console.warn;
  private originalConsoleError = console.error;
  private originalConsoleDebug = console.debug;
  private originalConsoleInfo = console.info;

  private params: ConsolePatcherParams;

  constructor(params: ConsolePatcherParams) {
    this.params = params;
  }

  patch() {
    console.log = this.patchConsoleMethod('log');
    console.warn = this.patchConsoleMethod('warn');
    console.error = this.patchConsoleMethod('error');
    console.debug = this.patchConsoleMethod('debug');
    console.info = this.patchConsoleMethod('info');
  }

  cleanup = () => {
    console.log = this.originalConsoleLog;
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
    console.debug = this.originalConsoleDebug;
    console.info = this.originalConsoleInfo;
  };

  private formatArgs = (args: unknown[]): string => util.format(...args);

  private patchConsoleMethod =
    (type: ConsoleLogPayload['type']) =>
    (...args: unknown[]) => {
      if (type === 'debug' && !this.params.debugMode) return;
      this.params.onNewMessage({
        type,
        content: this.formatArgs(args),
      });
    };
}
