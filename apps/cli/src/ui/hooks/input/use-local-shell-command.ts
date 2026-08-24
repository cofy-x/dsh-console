/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  formatBytes,
  isBinary,
  ShellExecutionService,
  type ShellExecutionResult,
} from '@cofy-x/dsh-console-core';
import type { Config } from '../../../config/config.js';
import { SHELL_COMMAND_NAME } from '../../constants.js';
import type {
  HistoryItemToolGroup,
  HistoryItemWithoutId,
  IndividualToolCallDisplay,
} from '../../types.js';
import { ToolCallStatus } from '../../types.js';
import type { AnsiOutput, ToolResultDisplay } from '../../tool-result.js';
import type { UseHistoryManagerReturn } from '../session/use-history-manager.js';
import { themeManager } from '../../theme/manager.js';

interface UseLocalShellCommandOptions {
  addItem: UseHistoryManagerReturn['addItem'];
  setPendingItem: Dispatch<SetStateAction<HistoryItemWithoutId | null>>;
  onDebugMessage(message: string): void;
  config: Config;
  setShellInputFocused(value: boolean): void;
  terminalWidth: number;
  terminalHeight: number;
}

function outputDisplay(output: string | AnsiOutput): ToolResultDisplay {
  return typeof output === 'string'
    ? { type: 'text', content: output }
    : { type: 'ansi', content: output };
}

/**
 * Executes `!` commands locally. Results are presentation-only and never enter
 * the canonical DSH Session or the active Agent's model context.
 */
export function useLocalShellCommand({
  addItem,
  setPendingItem,
  onDebugMessage,
  config,
  setShellInputFocused,
  terminalWidth,
  terminalHeight,
}: UseLocalShellCommandOptions) {
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const mountedRef = useRef(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activePtyId, setActivePtyId] = useState<number | undefined>(undefined);
  const [lastOutputTime, setLastOutputTime] = useState(0);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(
    (rawCommand: string): boolean => {
      const command = rawCommand.trim();
      if (command.length === 0 || controllerRef.current !== undefined) {
        return false;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setIsExecuting(true);

      const timestamp = Date.now();
      const callId = `local-shell-${timestamp}`;
      const targetDir = config.getTargetDir();
      const initialTool: IndividualToolCallDisplay = {
        callId,
        name: SHELL_COMMAND_NAME,
        description: command,
        status: ToolCallStatus.Executing,
        resultDisplay: { type: 'text', content: '' },
      };
      addItem({ type: 'user_shell', text: command }, timestamp);
      setPendingItem({ type: 'tool_group', tools: [initialTool] });

      void (async () => {
        let commandToExecute = command;
        let pwdFilePath: string | undefined;
        let cumulativeOutput: string | AnsiOutput = '';
        let binaryOutput = false;
        let binaryBytes = 0;

        if (os.platform() !== 'win32') {
          pwdFilePath = path.join(
            os.tmpdir(),
            `dsh_console_shell_pwd_${crypto.randomBytes(6).toString('hex')}.tmp`,
          );
          const terminated =
            command.endsWith(';') || command.endsWith('&')
              ? command
              : `${command};`;
          commandToExecute = `{ ${terminated} }; __code=$?; pwd > "${pwdFilePath}"; exit $__code`;
        }

        try {
          const activeTheme = themeManager.getActiveTheme();
          const execution = await ShellExecutionService.execute(
            commandToExecute,
            targetDir,
            (event) => {
              if (!mountedRef.current) return;
              switch (event.type) {
                case 'data':
                  if (binaryOutput) return;
                  if (config.isInteractiveShellEnabled()) {
                    cumulativeOutput = event.chunk;
                  } else if (
                    typeof cumulativeOutput === 'string' &&
                    typeof event.chunk === 'string'
                  ) {
                    cumulativeOutput += event.chunk;
                  }
                  break;
                case 'binary_detected':
                  binaryOutput = true;
                  break;
                case 'binary_progress':
                  binaryOutput = true;
                  binaryBytes = event.bytesReceived;
                  break;
                default:
                  break;
              }

              const display = binaryOutput
                ? binaryBytes > 0
                  ? `[Receiving binary output... ${formatBytes(binaryBytes)} received]`
                  : '[Binary output detected. Halting stream...]'
                : cumulativeOutput;
              setLastOutputTime(Date.now());
              setPendingItem((item) => {
                if (item?.type !== 'tool_group') return item;
                return {
                  ...item,
                  tools: item.tools.map((tool) =>
                    tool.callId === callId
                      ? { ...tool, resultDisplay: outputDisplay(display) }
                      : tool,
                  ),
                } satisfies HistoryItemToolGroup;
              });
            },
            controller.signal,
            config.isInteractiveShellEnabled(),
            {
              ...config.getShellExecutionConfig(),
              terminalWidth,
              terminalHeight,
              defaultFg: activeTheme.colors.Foreground,
              defaultBg: activeTheme.colors.Background,
            },
          );

          if (execution.pid !== undefined) {
            setActivePtyId(execution.pid);
            setPendingItem((item) => {
              if (item?.type !== 'tool_group') return item;
              return {
                ...item,
                tools: item.tools.map((tool) =>
                  tool.callId === callId
                    ? { ...tool, ptyId: execution.pid }
                    : tool,
                ),
              } satisfies HistoryItemToolGroup;
            });
          }

          const result = await execution.result;
          const finalTool = finalizeTool(
            initialTool,
            result,
            targetDir,
            pwdFilePath,
          );
          if (mountedRef.current) {
            addItem({ type: 'tool_group', tools: [finalTool] }, timestamp);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (mountedRef.current) {
            addItem(
              {
                type: 'tool_group',
                tools: [
                  {
                    ...initialTool,
                    status: controller.signal.aborted
                      ? ToolCallStatus.Canceled
                      : ToolCallStatus.Error,
                    resultDisplay: {
                      type: 'text',
                      content: controller.signal.aborted
                        ? 'Command was cancelled.'
                        : `Unable to execute command: ${message}`,
                    },
                  },
                ],
              },
              timestamp,
            );
            onDebugMessage(`Local shell execution failed: ${message}`);
          }
        } finally {
          if (mountedRef.current) setPendingItem(null);
          if (pwdFilePath !== undefined) {
            try {
              fs.unlinkSync(pwdFilePath);
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                onDebugMessage(`Unable to remove shell state file: ${String(error)}`);
              }
            }
          }
          if (controllerRef.current === controller) {
            controllerRef.current = undefined;
            if (mountedRef.current) {
              setIsExecuting(false);
              setActivePtyId(undefined);
              setShellInputFocused(false);
            }
          }
        }
      })();

      return true;
    },
    [
      addItem,
      config,
      onDebugMessage,
      setPendingItem,
      setShellInputFocused,
      terminalHeight,
      terminalWidth,
    ],
  );

  return { execute, cancel, isExecuting, activePtyId, lastOutputTime };
}

function finalizeTool(
  initialTool: IndividualToolCallDisplay,
  result: ShellExecutionResult,
  targetDir: string,
  pwdFilePath: string | undefined,
): IndividualToolCallDisplay {
  let output = isBinary(result.rawOutput)
    ? '[Command produced binary output, which is not shown.]'
    : result.output.trim() || '(Command produced no output)';
  let status = ToolCallStatus.Success;

  if (result.error !== null) {
    status = ToolCallStatus.Error;
    output = `${result.error.message}\n${output}`;
  } else if (result.aborted) {
    status = ToolCallStatus.Canceled;
    output = `Command was cancelled.\n${output}`;
  } else if (result.signal !== null && result.signal !== 0) {
    status = ToolCallStatus.Error;
    output = `Command terminated by signal: ${result.signal}.\n${output}`;
  } else if (result.exitCode !== 0) {
    status = ToolCallStatus.Error;
    output = `Command exited with code ${result.exitCode}.\n${output}`;
  }

  if (pwdFilePath !== undefined && fs.existsSync(pwdFilePath)) {
    const finalDir = fs.readFileSync(pwdFilePath, 'utf8').trim();
    if (finalDir && finalDir !== targetDir) {
      output = `WARNING: shell mode is stateless; the directory change to '${finalDir}' will not persist.\n\n${output}`;
    }
  }

  return {
    ...initialTool,
    status,
    resultDisplay: { type: 'text', content: output },
  };
}
