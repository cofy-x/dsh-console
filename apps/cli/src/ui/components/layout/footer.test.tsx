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
  const original = await importOriginal<typeof import('@cofy-x/dsh-console-core')>();
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
    it('should display a shortened path on a narrow terminal', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 79,
        uiState: { sessionStats: mockSessionStats },
      });
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const pathLength = Math.max(20, Math.floor(79 * 0.25));
      const expectedPath =
        '...' + tildePath.slice(tildePath.length - pathLength + 3);
      expect(lastFrame()).toContain(expectedPath);
    });

    it('should use wide layout at 80 columns', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 80,
        uiState: { sessionStats: mockSessionStats },
      });
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const expectedPath =
        '...' + tildePath.slice(tildePath.length - 80 * 0.25 + 3);
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
      width: 120,
      uiState: { sessionStats: mockSessionStats },
    });
    expect(lastFrame()).toContain(defaultProps.model);
  });

  it('displays the model name in a narrow terminal', () => {
    const { lastFrame } = renderWithProviders(<Footer />, {
      width: 99,
      uiState: { sessionStats: mockSessionStats },
    });
    expect(lastFrame()).toContain(defaultProps.model);
  });

  it.each([80, 160])(
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

      expect(lastFrame()).toContain(width < 120 ? 'R:0 I:0 F:0' : 'Renders:');
      expect(lastFrame()?.split('\n')).toHaveLength(1);
      unmount();
    },
  );

  describe('footer configuration filtering (golden snapshots)', () => {
    it('renders complete footer with all sections visible (baseline)', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 120,
        uiState: { sessionStats: mockSessionStats },
        settings: createMockSettings({
          ui: {
            footer: {
            },
          },
        }),
      });
      expect(lastFrame()).toMatchSnapshot('complete-footer-wide');
    });

    it('renders footer with all optional sections hidden (minimal footer)', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 120,
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
      expect(lastFrame()).toMatchSnapshot('footer-no-model');
    });

    it('renders complete footer in narrow terminal (baseline narrow)', () => {
      const { lastFrame } = renderWithProviders(<Footer />, {
        width: 79,
        uiState: { sessionStats: mockSessionStats },
        settings: createMockSettings({
          ui: {
            footer: {
            },
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

    expect(lastFrame()).toContain('deepseek/deepseek-reasoner');
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

    expect(lastFrame()).toContain('deepseek/deepseek-chat');
  });
});
