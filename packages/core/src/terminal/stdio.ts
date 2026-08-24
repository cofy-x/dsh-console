/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CoreEvent,
  coreEvents,
  type ConsoleLogPayload,
  type OutputPayload,
  type UserFeedbackPayload,
} from '../events/event-bus.js';

// Capture the original stdout and stderr write methods before any monkey patching occurs.
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

/**
 * Writes to the real stdout, bypassing any monkey patching on process.stdout.write.
 */
export function writeToStdout(
  ...args: Parameters<typeof process.stdout.write>
): boolean {
  return originalStdoutWrite(...args);
}

/**
 * Writes to the real stderr, bypassing any monkey patching on process.stderr.write.
 */
export function writeToStderr(
  ...args: Parameters<typeof process.stderr.write>
): boolean {
  return originalStderrWrite(...args);
}

/**
 * Monkey patches process.stdout.write and process.stderr.write to redirect output to the provided logger.
 * This prevents stray output from libraries (or the app itself) from corrupting the UI.
 * Returns a cleanup function that restores the original write methods.
 */
export function patchStdio(): () => void {
  const previousStdoutWrite = process.stdout.write;
  const previousStderrWrite = process.stderr.write;

  process.stdout.write = (
    chunk: Uint8Array | string,
    encodingOrCb?:
      | BufferEncoding
      | ((err?: NodeJS.ErrnoException | null) => void),
    cb?: (err?: NodeJS.ErrnoException | null) => void,
  ) => {
    const encoding =
      typeof encodingOrCb === 'string' ? encodingOrCb : undefined;
    coreEvents.emitOutput(false, chunk, encoding);
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    if (callback) {
      callback();
    }
    return true;
  };

  process.stderr.write = (
    chunk: Uint8Array | string,
    encodingOrCb?:
      | BufferEncoding
      | ((err?: NodeJS.ErrnoException | null) => void),
    cb?: (err?: NodeJS.ErrnoException | null) => void,
  ) => {
    const encoding =
      typeof encodingOrCb === 'string' ? encodingOrCb : undefined;
    coreEvents.emitOutput(true, chunk, encoding);
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    if (callback) {
      callback();
    }
    return true;
  };

  return () => {
    process.stdout.write = previousStdoutWrite;
    process.stderr.write = previousStderrWrite;
  };
}

/**
 * Creates proxies for process.stdout and process.stderr that use the real write methods
 * (writeToStdout and writeToStderr) bypassing any monkey patching.
 * This is used to write to the real output even when stdio is patched.
 */
export function createWorkingStdio() {
  const inkStdout = new Proxy(process.stdout, {
    get(target, prop, receiver) {
      if (prop === 'write') {
        return writeToStdout;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });

  const inkStderr = new Proxy(process.stderr, {
    get(target, prop, receiver) {
      if (prop === 'write') {
        return writeToStderr;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });

  return { stdout: inkStdout, stderr: inkStderr };
}

/**
 * Initializes listeners to pipe Core output events directly to the real stdout/stderr.
 * This is typically used in non-interactive modes or when UI is not taking over output.
 */
export function initializeOutputListenersAndFlush() {
  // If there are no listeners for output, make sure we flush so output is not
  // lost.
  if (coreEvents.listenerCount(CoreEvent.Output) === 0) {
    // In non-interactive mode, ensure we drain any buffered output or logs to stderr
    coreEvents.on(CoreEvent.Output, (payload: OutputPayload) => {
      if (payload.isStderr) {
        writeToStderr(payload.chunk, payload.encoding);
      } else {
        writeToStdout(payload.chunk, payload.encoding);
      }
    });

    if (coreEvents.listenerCount(CoreEvent.ConsoleLog) === 0) {
      coreEvents.on(CoreEvent.ConsoleLog, (payload: ConsoleLogPayload) => {
        if (payload.type === 'error' || payload.type === 'warn') {
          writeToStderr(payload.content);
        } else {
          writeToStdout(payload.content);
        }
      });
    }

    if (coreEvents.listenerCount(CoreEvent.UserFeedback) === 0) {
      coreEvents.on(CoreEvent.UserFeedback, (payload: UserFeedbackPayload) => {
        if (payload.severity === 'error' || payload.severity === 'warning') {
          writeToStderr(payload.message);
        } else {
          writeToStdout(payload.message);
        }
      });
    }
  }
  coreEvents.drainBacklogs();
}
