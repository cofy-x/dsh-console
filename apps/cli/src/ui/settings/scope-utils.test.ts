/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingScope } from '../../config/settings-types.js';
import type { LoadedSettings } from '../../config/user-settings.js';
import { getScopeItems, getScopeMessageForSetting } from './scope-utils.js';
import { settingExistsInScope } from '../../config/settings-utils.js';

vi.mock('../../config/settings-types.js', () => ({
  SettingScope: {
    User: 'user',
    Workspace: 'workspace',
    System: 'system',
  },
  isLoadableSettingScope: (scope: string) =>
    ['user', 'workspace', 'system'].includes(scope),
}));

vi.mock('../../config/settings-utils.js', () => ({
  settingExistsInScope: vi.fn(),
}));

describe('scope-utils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getScopeItems', () => {
    it('should return scope items with correct labels and values', () => {
      const items = getScopeItems();
      expect(items).toEqual([
        { label: 'User Settings', value: SettingScope.User },
        { label: 'Workspace Settings', value: SettingScope.Workspace },
        { label: 'System Settings', value: SettingScope.System },
      ]);
    });
  });

  describe('getScopeMessageForSetting', () => {
    let mockSettings: { forScope: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockSettings = {
        forScope: vi.fn().mockReturnValue({ settings: {} }),
      };
    });

    it('should return empty string if not modified in other scopes', () => {
      vi.mocked(settingExistsInScope).mockReturnValue(false);
      const message = getScopeMessageForSetting(
        'key',
        SettingScope.User,
        mockSettings as unknown as LoadedSettings,
      );
      expect(message).toBe('');
    });

    it('should return message indicating modification in other scopes', () => {
      vi.mocked(settingExistsInScope).mockReturnValue(true);

      const message = getScopeMessageForSetting(
        'key',
        SettingScope.User,
        mockSettings as unknown as LoadedSettings,
      );
      expect(message).toMatch(/Also modified in/);
      expect(message).toMatch(/workspace/);
      expect(message).toMatch(/system/);
    });

    it('should return message indicating modification in other scopes but not current', () => {
      const workspaceSettings = { scope: 'workspace' };
      const systemSettings = { scope: 'system' };
      const userSettings = { scope: 'user' };

      mockSettings.forScope.mockImplementation((scope: string) => {
        if (scope === SettingScope.Workspace)
          return { settings: workspaceSettings };
        if (scope === SettingScope.System) return { settings: systemSettings };
        if (scope === SettingScope.User) return { settings: userSettings };
        return { settings: {} };
      });

      vi.mocked(settingExistsInScope).mockImplementation(
        (_key, settings: unknown) => {
          if (settings === workspaceSettings) return true;
          if (settings === systemSettings) return false;
          if (settings === userSettings) return false;
          return false;
        },
      );

      const message = getScopeMessageForSetting(
        'key',
        SettingScope.User,
        mockSettings as unknown as LoadedSettings,
      );
      expect(message).toBe('(Modified in workspace)');
    });
  });
});
