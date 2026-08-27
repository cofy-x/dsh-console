/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MockedFunction } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render } from '../../../test-utils/render.js';
import { waitFor } from '../../../test-utils/async.js';
import { useGitBranchName } from './use-git-branch-name.js';
import path from 'node:path';
import { spawnAsync as mockSpawnAsync } from '@cofy-x/dsh-console-core';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

// Mock @cofy-x/dsh-console-core
vi.mock('@cofy-x/dsh-console-core', async () => {
  const original =
    await vi.importActual<typeof import('@cofy-x/dsh-console-core')>(
      '@cofy-x/dsh-console-core',
    );
  return {
    ...original,
    spawnAsync: vi.fn(),
  };
});

// Mock node:fs
vi.mock('node:fs', () => {
  const mockWatch = vi.fn();
  return {
    default: {
      watch: mockWatch,
      constants: {
        F_OK: 0,
      },
    },
    watch: mockWatch,
    constants: {
      F_OK: 0,
    },
  };
});

// Mock node:fs/promises
vi.mock('node:fs/promises', () => {
  const mockAccess = vi.fn();
  return {
    default: {
      access: mockAccess,
    },
    access: mockAccess,
  };
});

const CWD = '/test/project';
const GIT_LOGS_HEAD_PATH = path.join(CWD, '.git', 'logs', 'HEAD');

describe('useGitBranchName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderGitBranchNameHook = (cwd: string) => {
    let hookResult: ReturnType<typeof useGitBranchName>;
    function TestComponent() {
      hookResult = useGitBranchName(cwd);
      return null;
    }
    const { rerender, unmount } = render(<TestComponent />);
    return {
      result: {
        get current() {
          return hookResult;
        },
      },
      rerender: () => rerender(<TestComponent />),
      unmount,
    };
  };

  it('should return branch name', async () => {
    (mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>).mockResolvedValue(
      {
        stdout: 'main\n',
      } as { stdout: string; stderr: string },
    );
    const { result, rerender } = renderGitBranchNameHook(CWD);

    await act(async () => {
      rerender(); // Rerender to get the updated state
    });

    expect(result.current).toBe('main');
  });

  it('should return undefined if git command fails', async () => {
    (mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>).mockRejectedValue(
      new Error('Git error'),
    );

    const { result, rerender } = renderGitBranchNameHook(CWD);
    expect(result.current).toBeUndefined();

    await act(async () => {
      rerender();
    });
    expect(result.current).toBeUndefined();
  });

  it('should return short commit hash if branch is HEAD (detached state)', async () => {
    (
      mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>
    ).mockImplementation(async (command: string, args: string[]) => {
      if (args.includes('--abbrev-ref')) {
        return { stdout: 'HEAD\n' } as { stdout: string; stderr: string };
      } else if (args.includes('--short')) {
        return { stdout: 'a1b2c3d\n' } as { stdout: string; stderr: string };
      }
      return { stdout: '' } as { stdout: string; stderr: string };
    });

    const { result, rerender } = renderGitBranchNameHook(CWD);
    await act(async () => {
      rerender();
    });
    expect(result.current).toBe('a1b2c3d');
  });

  it('should return undefined if branch is HEAD and getting commit hash fails', async () => {
    (
      mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>
    ).mockImplementation(async (command: string, args: string[]) => {
      if (args.includes('--abbrev-ref')) {
        return { stdout: 'HEAD\n' } as { stdout: string; stderr: string };
      } else if (args.includes('--short')) {
        throw new Error('Git error');
      }
      return { stdout: '' } as { stdout: string; stderr: string };
    });

    const { result, rerender } = renderGitBranchNameHook(CWD);
    await act(async () => {
      rerender();
    });
    expect(result.current).toBeUndefined();
  });

  it('should update branch name when .git/HEAD changes', async () => {
    vi.mocked(fsPromises.access).mockResolvedValue(undefined);

    let watchCallback:
      | ((eventType: string, filename: string | null) => void)
      | undefined;
    vi.mocked(fs.watch).mockImplementation(((...args: unknown[]) => {
      const callback = args[1] as (
        eventType: string,
        filename: string | null,
      ) => void;
      watchCallback = callback;
      return {
        close: vi.fn(),
      } as unknown as fs.FSWatcher;
    }));

    (mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>)
      .mockResolvedValueOnce({ stdout: 'main\n' } as {
        stdout: string;
        stderr: string;
      })
      .mockResolvedValue({ stdout: 'develop\n' } as {
        stdout: string;
        stderr: string;
      });

    const { result, rerender } = renderGitBranchNameHook(CWD);

    await act(async () => {
      rerender();
    });
    expect(result.current).toBe('main');

    // Wait for watcher to be set up
    await waitFor(() => {
      expect(fs.watch).toHaveBeenCalled();
    });

    // Simulate file change event
    await act(async () => {
      watchCallback?.('change', GIT_LOGS_HEAD_PATH);
      rerender();
    });

    await waitFor(() => {
      expect(result.current).toBe('develop');
    });
  });

  it('should handle watcher setup error silently', async () => {
    // Simulate access failure to cause watcher setup to fail
    vi.mocked(fsPromises.access).mockRejectedValue(
      new Error('ENOENT: no such file or directory'),
    );

    (mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>).mockResolvedValue(
      {
        stdout: 'main\n',
      } as { stdout: string; stderr: string },
    );

    const { result, rerender } = renderGitBranchNameHook(CWD);

    await act(async () => {
      rerender();
    });

    expect(result.current).toBe('main'); // Branch name should still be fetched initially

    // Wait a bit to ensure watcher setup has been attempted
    await new Promise((resolve) => setTimeout(resolve, 50));

    (
      mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>
    ).mockResolvedValueOnce({
      stdout: 'develop\n',
    } as { stdout: string; stderr: string });

    await act(async () => {
      rerender();
    });

    // Branch name should not change because watcher setup failed
    expect(result.current).toBe('main');
  });

  it('should cleanup watcher on unmount', async () => {
    vi.mocked(fsPromises.access).mockResolvedValue(undefined);

    const closeMock = vi.fn();
    vi.mocked(fs.watch).mockReturnValue({
      close: closeMock,
    } as unknown as fs.FSWatcher);

    (mockSpawnAsync as MockedFunction<typeof mockSpawnAsync>).mockResolvedValue(
      {
        stdout: 'main\n',
      } as { stdout: string; stderr: string },
    );

    const { unmount, rerender } = renderGitBranchNameHook(CWD);

    await act(async () => {
      rerender();
    });

    // Wait for watcher to be set up BEFORE unmounting
    await waitFor(() => {
      expect(fs.watch).toHaveBeenCalledWith(
        GIT_LOGS_HEAD_PATH,
        expect.any(Function),
      );
    });

    unmount();
    expect(closeMock).toHaveBeenCalled();
  });
});
