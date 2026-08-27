/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import {
  renderWithProviders,
  createMockSettings,
} from '../../../test-utils/render.js';
import { Footer } from './footer.js';
import { tildeifyPath } from '@cofy-x/dsh-console-core';
import type { SessionStatsState } from '../../contexts/session-context.js';
import type { Config } from '../../config/config.js';

vi.mock('@cofy-x/dsh-console-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
  return {
    ...original,
    shortenPath: (p: string, len: number) => {
      if (p.length > len) {
        return '...' + p.slice(p.length - len + 3);
      }
      return p;
    },
  };
});

const defaultProps = {
  model: 'deepseek/deepseek-chat',
  targetDir:
    '/Users/test/project/foo/bar/and/some/more/directories/to/make/it/long',
  branchName: 'main',
};

const mockSessionStats: SessionStatsState = {
  sessionId: 'test-session',
  sessionStartTime: new Date(),
  lastPromptTokenCount: 0,
  promptCount: 0,
  metrics: {
    models: {},
    tools: {
      totalCalls: 0,
      totalSuccess: 0,
      totalFail: 0,
      byName: {},
    },
  },
};

describe('<Footer />', () => {
  it('renders the component', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 120,
      uiState: {
        branchName: defaultProps.branchName,
        sessionStats: mockSessionStats,
      },
    });
    expect(lastFrame()).toBeDefined();
  });

  describe('path display', () => {
    it('keeps the workspace name on a narrow terminal', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 79,
        uiState: {
          branchName: defaultProps.branchName,
          sessionStats: mockSessionStats,
        },
      });
      expect(lastFrame()).toContain('long');
      expect(lastFrame()).not.toContain('(main*)');
    });

    it('uses the directory name in compact layout', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 120,
        uiState: { sessionStats: mockSessionStats },
      });
      expect(lastFrame()).toContain('long');
      expect(lastFrame()).not.toContain('...directories');
    });

    it('uses a shortened path in wide layout', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 160,
        uiState: { sessionStats: mockSessionStats },
      });
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const expectedPath =
        '...' + tildePath.slice(tildePath.length - 160 * 0.25 + 3);
      expect(lastFrame()).toContain(expectedPath);
    });
  });

  it('displays the branch name when provided', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 120,
      uiState: {
        branchName: defaultProps.branchName,
        sessionStats: mockSessionStats,
      },
    });
    expect(lastFrame()).toContain(`(${defaultProps.branchName}*)`);
  });

  it('does not display the branch name when not provided', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 120,
      uiState: { branchName: undefined, sessionStats: mockSessionStats },
    });
    expect(lastFrame()).not.toContain(`(${defaultProps.branchName}*)`);
  });

  it('displays the model name in a wide terminal', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 160,
      uiState: { sessionStats: mockSessionStats },
    });
    expect(lastFrame()).toContain(defaultProps.model);
  });

  it('displays the model name in a narrow terminal', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 99,
      uiState: { sessionStats: mockSessionStats },
    });
    expect(lastFrame()).toContain('deepseek-chat');
    expect(lastFrame()).not.toContain('deepseek/deepseek-chat');
  });

  it('displays prompt context usage after the active model', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 160,
      uiState: {
        sessionStats: {
          ...mockSessionStats,
          lastPromptTokenCount: 13_200,
          contextWindow: 128_000,
        },
        currentReasoningEffort: 'High',
      },
    });

    expect(lastFrame()).toContain(
      `${defaultProps.model} High | 13.2k/128k (10%)`,
    );
  });

  it('shows Side identity and Main progress while Side is active', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 160,
      uiState: {
        sessionStats: mockSessionStats,
        sideConversation: {
          activeSurface: 'side',
          mainBusy: true,
          sideBusy: false,
          sideSessionId: 'dsh-console-side-1',
        },
      },
    });
    expect(lastFrame()).toContain('Side · Main working');
    expect(lastFrame()).toContain('Ctrl+/ switch');
    expect(lastFrame()).not.toContain('Ctrl+C close');
  });

  it('shows only live delegated Agent count in the Footer', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 160,
      uiState: {
        sessionStats: mockSessionStats,
        subagentCatalog: {
          rootSessionId: 'main',
          status: 'ready',
          items: [],
          runningCount: 2,
        },
      },
    });
    expect(lastFrame()).toContain('2 agents working');
  });

  it('uses compact context usage on a narrow terminal', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 99,
      uiState: {
        sessionStats: {
          ...mockSessionStats,
          lastPromptTokenCount: 13_200,
          contextWindow: 128_000,
        },
      },
    });

    expect(lastFrame()).toContain('deepseek-chat | 13.2k/128k');
    expect(lastFrame()).not.toContain('(10%)');
  });

  it.each([80, 120, 160])(
    'keeps render diagnostics on the primary footer row at %i columns',
    (width) => {
      const config = {
        getDebugMode: () => true,
        getTargetDir: () => defaultProps.targetDir,
      } as unknown as Config;
      const { lastFrame, unmount } = renderWithProviders(<Footer />, {
        width,
        config,
        uiState: {
          showDebugProfiler: true,
          sessionStats: mockSessionStats,
        },
      });

      expect(lastFrame()).toContain(width < 160 ? 'R0 I0' : 'Renders:');
      expect(lastFrame()?.split('\n')).toHaveLength(1);
      unmount();
    },
  );

  it('prioritizes Side state over render diagnostics on a narrow terminal', () => {
    const config = {
      getDebugMode: () => true,
      getTargetDir: () => defaultProps.targetDir,
    } as unknown as Config;
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 99,
      config,
      uiState: {
        showDebugProfiler: true,
        sessionStats: mockSessionStats,
        sideConversation: {
          activeSurface: 'side',
          mainBusy: false,
          sideBusy: false,
          sideSessionId: 'dsh-console-side-1',
        },
      },
    });

    expect(lastFrame()).toContain('Side · Main idle · Ctrl+/');
    expect(lastFrame()).toContain('long --debug');
    expect(lastFrame()).not.toContain('R0 I0');
    expect(lastFrame()?.split('\n')).toHaveLength(1);
  });

  describe('footer configuration filtering (golden snapshots)', () => {
    it('renders the compact footer with all sections visible', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 120,
        uiState: { sessionStats: mockSessionStats },
        settings: createMockSettings({
          ui: {
            footer: {},
          },
        }),
      });
      expect(lastFrame()).toMatchSnapshot('complete-footer-compact');
    });

    it('renders footer with all optional sections hidden (minimal footer)', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 160,
        uiState: { sessionStats: mockSessionStats },
        settings: createMockSettings({
          ui: {
            footer: {
              hideCWD: true,
              hideModelInfo: true,
            },
          },
        }),
      });
      expect(lastFrame()).toMatchSnapshot('footer-minimal');
    });

    it('renders footer with only model info hidden (partial filtering)', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 120,
        uiState: { sessionStats: mockSessionStats },
        settings: createMockSettings({
          ui: {
            footer: {
              hideCWD: false,
              hideModelInfo: true,
            },
          },
        }),
      });
      expect(lastFrame()).toMatchSnapshot('footer-no-model-wide');
    });

    it('renders complete footer in narrow terminal (baseline narrow)', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 79,
        uiState: { sessionStats: mockSessionStats },
        settings: createMockSettings({
          ui: {
            footer: {},
          },
        }),
      });
      expect(lastFrame()).toMatchSnapshot('complete-footer-narrow');
    });
  });
});

describe('active model display', () => {
  it('displays the current runtime model instead of another available model', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 120,
      uiState: {
        sessionStats: mockSessionStats,
        currentModel: 'deepseek/deepseek-reasoner',
      },
    });

    expect(lastFrame()).toContain('deepseek-reasoner');
    expect(lastFrame()).not.toContain('deepseek/deepseek-chat');
  });

  it('displays a different current runtime model', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 120,
      uiState: {
        sessionStats: mockSessionStats,
        currentModel: 'deepseek/deepseek-chat',
      },
    });

    expect(lastFrame()).toContain('deepseek-chat');
  });
});
