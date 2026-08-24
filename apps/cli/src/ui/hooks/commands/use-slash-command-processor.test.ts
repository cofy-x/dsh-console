/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { renderHook } from '../../../test-utils/render.js';
import { waitFor } from '../../../test-utils/async.js';
import { useSlashCommandProcessor } from './use-slash-command-processor.js';
import type { SlashCommand } from '../../commands/types.js';
import { CommandKind } from '../../commands/types.js';
import { MessageType } from '../../types.js';
import { BuiltinCommandLoader } from '../../../services/builtin-command-loader.js';

const {
  mockBuiltinLoadCommands,
  mockUseAlternateBuffer,
} = vi.hoisted(() => ({
  mockBuiltinLoadCommands: vi.fn().mockResolvedValue([]),
  mockUseAlternateBuffer: vi.fn().mockReturnValue(false),
}));

vi.mock('../../hooks/terminal/use-alternate-buffer.js', () => ({
  useAlternateBuffer: mockUseAlternateBuffer,
}));

vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@cofy-x/dsh-console-core')>();

  return {
    ...original,
    getIdeInstaller: vi.fn().mockReturnValue(null),
  };
});

const { mockProcessExit } = vi.hoisted(() => ({
  mockProcessExit: vi.fn((_code?: number): never => undefined as never),
}));

vi.mock('node:process', () => {
  const mockProcess: Partial<NodeJS.Process> = {
    exit: mockProcessExit,
    platform: 'sunos',
    cwd: () => '/fake/dir',
    env: {},
  } as unknown as NodeJS.Process;
  return {
    ...mockProcess,
    default: mockProcess,
  };
});

vi.mock('../../../services/builtin-command-loader.js', () => ({
  BuiltinCommandLoader: vi.fn(() => ({
    loadCommands: mockBuiltinLoadCommands,
  })),
}));

vi.mock('../../contexts/session-context.js', () => ({
  useSessionStats: vi.fn(() => ({ stats: {} })),
}));

const { mockRunExitCleanup } = vi.hoisted(() => ({
  mockRunExitCleanup: vi.fn(),
}));

vi.mock('../../../utils/cleanup.js', () => ({
  runExitCleanup: mockRunExitCleanup,
}));

function createTestCommand(
  overrides: Partial<SlashCommand>,
  kind: CommandKind = CommandKind.BUILT_IN,
): SlashCommand {
  return {
    name: 'test',
    description: 'a test command',
    kind,
    ...overrides,
  };
}

describe('useSlashCommandProcessor', () => {
  const mockAddItem = vi.fn();
  const mockClearItems = vi.fn();
  const mockLoadHistory = vi.fn();
  const mockOpenThemeDialog = vi.fn();
  const mockSetQuittingMessages = vi.fn();

  let unmountHook: (() => Promise<void>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(BuiltinCommandLoader).mockClear();
    mockBuiltinLoadCommands.mockResolvedValue([]);
    mockUseAlternateBuffer.mockReturnValue(false);
    vi.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (unmountHook) {
      await unmountHook();
      unmountHook = undefined;
    }
    vi.restoreAllMocks();
  });

  const setupProcessorHook = async (
    options: {
      builtinCommands?: SlashCommand[];
      setIsProcessing?: (isProcessing: boolean) => void;
      refreshStatic?: () => void;
    } = {},
  ) => {
    const {
      builtinCommands = [],
      setIsProcessing = vi.fn(),
      refreshStatic = vi.fn(),
    } = options;

    mockBuiltinLoadCommands.mockResolvedValue(Object.freeze(builtinCommands));

    let result!: { current: ReturnType<typeof useSlashCommandProcessor> };
    let unmount!: () => void;
    let rerender!: (props?: unknown) => void;

    await act(async () => {
      const hook = renderHook(() =>
        useSlashCommandProcessor(
          mockAddItem,
          mockClearItems,
          mockLoadHistory,
          refreshStatic,
          vi.fn(), // toggleVimEnabled
          setIsProcessing,
          {
            openThemeDialog: mockOpenThemeDialog,
            openEditorDialog: vi.fn(),
            openSettingsDialog: vi.fn(),
            quit: mockSetQuittingMessages,
            toggleDebugProfiler: vi.fn(),
            setText: vi.fn(),
          },
          vi.fn(), // setCustomDialog
        ),
      );
      result = hook.result;
      unmount = hook.unmount;
      rerender = hook.rerender;
    });

    unmountHook = async () => unmount();

    await waitFor(() => {
      expect(result.current.slashCommands).toBeDefined();
    });

    return {
      get current() {
        return result.current;
      },
      unmount,
      rerender: async () => {
        rerender();
      },
    };
  };

  describe('Console Clear Safety', () => {
    it('should not call console.clear if alternate buffer is active', async () => {
      mockUseAlternateBuffer.mockReturnValue(true);
      const clearCommand = createTestCommand({
        name: 'clear',
        action: async (context) => {
          context.ui.clear();
        },
      });
      const result = await setupProcessorHook({
        builtinCommands: [clearCommand],
      });

      await act(async () => {
        await result.current.handleSlashCommand('/clear');
      });

      expect(mockClearItems).toHaveBeenCalled();
    });

    it('should call console.clear if alternate buffer is not active', async () => {
      mockUseAlternateBuffer.mockReturnValue(false);
      const clearCommand = createTestCommand({
        name: 'clear',
        action: async (context) => {
          context.ui.clear();
        },
      });
      const result = await setupProcessorHook({
        builtinCommands: [clearCommand],
      });

      await act(async () => {
        await result.current.handleSlashCommand('/clear');
      });

      expect(mockClearItems).toHaveBeenCalled();
    });
  });

  describe('Initialization and Command Loading', () => {


    it('should provide an immutable array of commands to consumers', async () => {
      const testCommand = createTestCommand({ name: 'test' });
      const result = await setupProcessorHook({
        builtinCommands: [testCommand],
      });

      await waitFor(() => {
        expect(result.current.slashCommands).toHaveLength(1);
      });

      const commands = result.current.slashCommands;

      expect(() => {
        // @ts-expect-error - We are intentionally testing a violation of the readonly type.
        commands.push(createTestCommand({ name: 'rogue' }));
      }).toThrow(TypeError);
    });

  });

  describe('Command Execution Logic', () => {
    it('should display an error for an unknown command', async () => {
      const result = await setupProcessorHook();
      await waitFor(() => expect(result.current.slashCommands).toBeDefined());

      await act(async () => {
        await result.current.handleSlashCommand('/nonexistent');
      });

      // Expect 2 calls: one for the user's input, one for the error message.
      expect(mockAddItem).toHaveBeenCalledTimes(2);
      expect(mockAddItem).toHaveBeenLastCalledWith(
        {
          type: MessageType.ERROR,
          text: 'Unknown command: /nonexistent',
        },
        expect.any(Number),
      );
    });

    it('should display help for a parent command invoked without a subcommand', async () => {
      const parentCommand: SlashCommand = {
        name: 'parent',
        description: 'a parent command',
        kind: CommandKind.BUILT_IN,
        subCommands: [
          {
            name: 'child1',
            description: 'First child.',
            kind: CommandKind.BUILT_IN,
          },
        ],
      };
      const result = await setupProcessorHook({
        builtinCommands: [parentCommand],
      });
      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      await act(async () => {
        await result.current.handleSlashCommand('/parent');
      });

      expect(mockAddItem).toHaveBeenCalledTimes(2);
      expect(mockAddItem).toHaveBeenLastCalledWith(
        {
          type: MessageType.INFO,
          text: expect.stringContaining(
            "Command '/parent' requires a subcommand.",
          ),
        },
        expect.any(Number),
      );
    });

    it('should correctly find and execute a nested subcommand', async () => {
      const childAction = vi.fn();
      const parentCommand: SlashCommand = {
        name: 'parent',
        description: 'a parent command',
        kind: CommandKind.BUILT_IN,
        subCommands: [
          {
            name: 'child',
            description: 'a child command',
            kind: CommandKind.BUILT_IN,
            action: childAction,
          },
        ],
      };
      const result = await setupProcessorHook({
        builtinCommands: [parentCommand],
      });
      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      await act(async () => {
        await result.current.handleSlashCommand('/parent child with args');
      });

      expect(childAction).toHaveBeenCalledTimes(1);

      expect(childAction).toHaveBeenCalledWith(
        expect.objectContaining({
          invocation: {
            raw: '/parent child with args',
            name: 'child',
            args: 'with args',
            signal: expect.any(AbortSignal),
          },
          ui: expect.objectContaining({
            addItem: mockAddItem,
          }),
        }),
        'with args',
      );
    });

    it('sets isProcessing to false if the the input is not a command', async () => {
      const setMockIsProcessing = vi.fn();
      const result = await setupProcessorHook({
        setIsProcessing: setMockIsProcessing,
      });

      await act(async () => {
        await result.current.handleSlashCommand('imnotacommand');
      });

      expect(setMockIsProcessing).not.toHaveBeenCalled();
    });

    it('sets isProcessing to false if the command has an error', async () => {
      const setMockIsProcessing = vi.fn();
      const failCommand = createTestCommand({
        name: 'fail',
        action: vi.fn().mockRejectedValue(new Error('oh no!')),
      });

      const result = await setupProcessorHook({
        builtinCommands: [failCommand],
        setIsProcessing: setMockIsProcessing,
      });

      await waitFor(() => expect(result.current.slashCommands).toBeDefined());

      await act(async () => {
        await result.current.handleSlashCommand('/fail');
      });

      expect(setMockIsProcessing).toHaveBeenNthCalledWith(1, true);
      expect(setMockIsProcessing).toHaveBeenNthCalledWith(2, false);
    });

    it('should set isProcessing to true during execution and false afterwards', async () => {
      const mockSetIsProcessing = vi.fn();
      const command = createTestCommand({
        name: 'long-running',
        action: () => new Promise((resolve) => setTimeout(resolve, 50)),
      });

      const result = await setupProcessorHook({
        builtinCommands: [command],
        setIsProcessing: mockSetIsProcessing,
      });
      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      const executionPromise = act(async () => {
        await result.current.handleSlashCommand('/long-running');
      });

      // It should be true immediately after starting
      expect(mockSetIsProcessing).toHaveBeenNthCalledWith(1, true);
      // It should not have been called with false yet
      expect(mockSetIsProcessing).not.toHaveBeenCalledWith(false);

      await executionPromise;

      // After the promise resolves, it should be called with false
      expect(mockSetIsProcessing).toHaveBeenNthCalledWith(2, false);
      expect(mockSetIsProcessing).toHaveBeenCalledTimes(2);
    });
  });

  describe('Action Result Handling', () => {
    describe('Dialog actions', () => {
      it.each([
        {
          dialogType: 'theme',
          commandName: 'themecmd',
          mockFn: mockOpenThemeDialog,
        },
      ])(
        'should handle "dialog: $dialogType" action',
        async ({ dialogType, commandName, mockFn }) => {
          const command = createTestCommand({
            name: commandName,
            action: vi
              .fn()
              .mockResolvedValue({ type: 'dialog', dialog: dialogType }),
          });
          const result = await setupProcessorHook({
            builtinCommands: [command],
          });
          await waitFor(() =>
            expect(result.current.slashCommands).toHaveLength(1),
          );

          await act(async () => {
            await result.current.handleSlashCommand(`/${commandName}`);
          });

          expect(mockFn).toHaveBeenCalled();
        },
      );
    });

    it('should call refreshStatic exactly once when ui.loadHistory is called', async () => {
      const mockRefreshStatic = vi.fn();
      const result = await setupProcessorHook({
        refreshStatic: mockRefreshStatic,
      });

      await act(async () => {
        result.current.commandContext.ui.loadHistory([]);
      });

      expect(mockLoadHistory).toHaveBeenCalled();
      expect(mockRefreshStatic).toHaveBeenCalledTimes(1);
    });

    it('should handle a "quit" action', async () => {
      const quitAction = vi
        .fn()
        .mockResolvedValue({ type: 'quit', messages: ['bye'] });
      const command = createTestCommand({
        name: 'exit',
        action: quitAction,
      });
      const result = await setupProcessorHook({
        builtinCommands: [command],
      });

      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      await act(async () => {
        await result.current.handleSlashCommand('/exit');
      });

      expect(mockSetQuittingMessages).toHaveBeenCalledWith(['bye']);
    });

  });

  describe('Command Parsing and Matching', () => {
    it('should be case-sensitive', async () => {
      const command = createTestCommand({ name: 'test' });
      const result = await setupProcessorHook({
        builtinCommands: [command],
      });
      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      await act(async () => {
        // Use uppercase when command is lowercase
        await result.current.handleSlashCommand('/Test');
      });

      // It should fail and call addItem with an error
      expect(mockAddItem).toHaveBeenCalledWith(
        {
          type: MessageType.ERROR,
          text: 'Unknown command: /Test',
        },
        expect.any(Number),
      );
    });

    it('should correctly match an altName', async () => {
      const action = vi.fn();
      const command = createTestCommand({
        name: 'main',
        altNames: ['alias'],
        description: 'a command with an alias',
        action,
      });
      const result = await setupProcessorHook({
        builtinCommands: [command],
      });
      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      await act(async () => {
        await result.current.handleSlashCommand('/alias');
      });

      expect(action).toHaveBeenCalledTimes(1);
      expect(mockAddItem).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: MessageType.ERROR }),
      );
    });

    it('should handle extra whitespace around the command', async () => {
      const action = vi.fn();
      const command = createTestCommand({ name: 'test', action });
      const result = await setupProcessorHook({
        builtinCommands: [command],
      });
      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      await act(async () => {
        await result.current.handleSlashCommand('  /test  with-args  ');
      });

      expect(action).toHaveBeenCalledWith(expect.anything(), 'with-args');
    });

    it('should handle `?` as a command prefix', async () => {
      const action = vi.fn();
      const command = createTestCommand({ name: 'help', action });
      const result = await setupProcessorHook({
        builtinCommands: [command],
      });
      await waitFor(() => expect(result.current.slashCommands).toHaveLength(1));

      await act(async () => {
        await result.current.handleSlashCommand('?help');
      });

      expect(action).toHaveBeenCalledTimes(1);
    });
  });


  describe('Lifecycle', () => {
    it('should abort command loading when the hook unmounts', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      const { unmount } = await setupProcessorHook();

      unmount();

      expect(abortSpy).toHaveBeenCalledTimes(1);
    });
  });



});
