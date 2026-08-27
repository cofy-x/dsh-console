/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import { homedir, platform } from 'node:os';
import {
  DSH_CONSOLE_DIR,
  coreEvents,
  getErrorMessage,
  Storage,
} from '@cofy-x/dsh-console-core';
import { FatalConfigError } from './errors.js';
import {
  getSettingsSchema,
  type MergedSettings,
  type Settings,
} from './settings-schema.js';
import { customDeepMerge } from './deep-merge.js';
import {
  SettingScope,
  type LoadableSettingScope,
  type MergeStrategy,
  type SettingDefinition,
  type SettingsError,
  type SettingsSchema,
} from './settings-types.js';
import { updateSettingsFilePreservingFormat } from '../utils/comment-json.js';
import stripJsonComments from 'strip-json-comments';
import {
  formatValidationError,
  validateSettings,
} from './settings-validation.js';
import { resolveEnvVarsInObject } from '../utils/envVarResolver.js';

export const USER_SETTINGS_PATH = Storage.getGlobalSettingsPath();
export const USER_SETTINGS_DIR = path.dirname(USER_SETTINGS_PATH);
export const DEFAULT_EXCLUDED_ENV_VARS = ['DEBUG', 'DEBUG_MODE'];

function getMergeStrategyForPath(path: string[]): MergeStrategy | undefined {
  let current: SettingDefinition | undefined = undefined;
  let currentSchema: SettingsSchema | undefined = getSettingsSchema();
  let parent: SettingDefinition | undefined = undefined;

  for (const key of path) {
    if (!currentSchema || !currentSchema[key]) {
      // Key not found in schema - check if parent has additionalProperties
      if (parent?.additionalProperties?.mergeStrategy) {
        return parent.additionalProperties.mergeStrategy;
      }
      return undefined;
    }
    parent = current;
    current = currentSchema[key];
    currentSchema = current.properties;
  }

  return current?.mergeStrategy;
}

export function getSystemSettingsPath(): string {
  if (process.env['DSH_CONSOLE_SYSTEM_SETTINGS_PATH']) {
    return process.env['DSH_CONSOLE_SYSTEM_SETTINGS_PATH'];
  }
  if (platform() === 'darwin') {
    return '/Library/Application Support/dsh-console/settings.json';
  } else if (platform() === 'win32') {
    return 'C:\\ProgramData\\dsh-console\\settings.json';
  } else {
    return '/etc/dsh-console/settings.json';
  }
}

export function getSystemDefaultsPath(): string {
  if (process.env['DSH_CONSOLE_SYSTEM_DEFAULTS_PATH']) {
    return process.env['DSH_CONSOLE_SYSTEM_DEFAULTS_PATH'];
  }
  return path.join(
    path.dirname(getSystemSettingsPath()),
    'system-defaults.json',
  );
}

export function getDefaultsFromSchema(
  schema: SettingsSchema = getSettingsSchema(),
): Settings {
  const defaults: Record<string, unknown> = {};
  for (const key in schema) {
    const definition = schema[key];
    if (definition.properties) {
      defaults[key] = getDefaultsFromSchema(definition.properties);
    } else if (definition.default !== undefined) {
      defaults[key] = definition.default;
    }
  }
  return defaults;
}

export function mergeSettings(
  system: Settings,
  systemDefaults: Settings,
  user: Settings,
  workspace: Settings,
  isTrusted: boolean,
): MergedSettings {
  const safeWorkspace = isTrusted ? workspace : ({} as Settings);
  const schemaDefaults = getDefaultsFromSchema();

  // Settings are merged with the following precedence (last one wins for
  // single values):
  // 1. Schema Defaults (Built-in)
  // 2. System Defaults
  // 3. User Settings
  // 4. Workspace Settings
  // 5. System Settings (as overrides)
  return customDeepMerge(
    getMergeStrategyForPath,
    schemaDefaults,
    systemDefaults,
    user,
    safeWorkspace,
    system,
  ) as MergedSettings;
}

/**
 * Creates a fully populated MergedSettings object for testing purposes.
 * It merges the provided overrides with the default settings from the schema.
 *
 * @param overrides Partial settings to override the defaults.
 * @returns A complete MergedSettings object.
 */
export function createTestMergedSettings(
  overrides: Partial<Settings> = {},
): MergedSettings {
  return customDeepMerge(
    getMergeStrategyForPath,
    getDefaultsFromSchema(),
    overrides,
  ) as MergedSettings;
}

function setNestedProperty(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) return;

  let current: Record<string, unknown> = obj;
  for (const key of keys) {
    if (current[key] === undefined) {
      current[key] = {};
    }
    const next = current[key];
    if (typeof next === 'object' && next !== null) {
      current = next as Record<string, unknown>;
    } else {
      // This path is invalid, so we stop.
      return;
    }
  }
  current[lastKey] = value;
}

export interface SettingsFile {
  settings: Settings;
  originalSettings: Settings;
  path: string;
  rawJson?: string;
}

export class LoadedSettings {
  constructor(
    system: SettingsFile,
    systemDefaults: SettingsFile,
    user: SettingsFile,
    workspace: SettingsFile,
    isTrusted: boolean,
    errors: SettingsError[] = [],
  ) {
    this.system = system;
    this.systemDefaults = systemDefaults;
    this.user = user;
    this.workspace = workspace;
    this.isTrusted = isTrusted;
    this.errors = errors;
    this._merged = this.computeMergedSettings();
  }

  readonly system: SettingsFile;
  readonly systemDefaults: SettingsFile;
  readonly user: SettingsFile;
  readonly workspace: SettingsFile;
  readonly isTrusted: boolean;
  readonly errors: SettingsError[];

  private _merged: MergedSettings;

  get merged(): MergedSettings {
    return this._merged;
  }

  private computeMergedSettings(): MergedSettings {
    return mergeSettings(
      this.system.settings,
      this.systemDefaults.settings,
      this.user.settings,
      this.workspace.settings,
      this.isTrusted,
    );
  }

  forScope(scope: LoadableSettingScope): SettingsFile {
    switch (scope) {
      case SettingScope.User:
        return this.user;
      case SettingScope.Workspace:
        return this.workspace;
      case SettingScope.System:
        return this.system;
      case SettingScope.SystemDefaults:
        return this.systemDefaults;
      default:
        throw new Error(`Invalid scope: ${scope}`);
    }
  }

  setValue(scope: LoadableSettingScope, key: string, value: unknown): void {
    const settingsFile = this.forScope(scope);
    setNestedProperty(settingsFile.settings, key, value);
    setNestedProperty(settingsFile.originalSettings, key, value);
    this._merged = this.computeMergedSettings();
    saveSettings(settingsFile);
    coreEvents.emitSettingsChanged();
  }
}

function findEnvFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    // Prefer the dsh-console-specific environment file.
    const dshConsoleEnvPath = path.join(
      currentDir,
      DSH_CONSOLE_DIR,
      '.env',
    );
    if (fs.existsSync(dshConsoleEnvPath)) {
      return dshConsoleEnvPath;
    }
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir || !parentDir) {
      // Check the product-specific .env under home as a fallback.
      const homeDshConsoleEnvPath = path.join(
        homedir(),
        DSH_CONSOLE_DIR,
        '.env',
      );
      if (fs.existsSync(homeDshConsoleEnvPath)) {
        return homeDshConsoleEnvPath;
      }
      const homeEnvPath = path.join(homedir(), '.env');
      if (fs.existsSync(homeEnvPath)) {
        return homeEnvPath;
      }
      return null;
    }
    currentDir = parentDir;
  }
}

export function loadEnvironment(settings: Settings): void {
  const envFilePath = findEnvFile(process.cwd());

  if (envFilePath) {
    // Manually parse and load environment variables to handle exclusions correctly.
    // This avoids modifying environment variables that were already set from the shell.
    try {
      const envFileContent = fs.readFileSync(envFilePath, 'utf-8');
      const parsedEnv = dotenv.parse(envFileContent);

      const excludedVars =
        settings?.advanced?.excludedEnvVars || DEFAULT_EXCLUDED_ENV_VARS;
      const isProjectEnvFile = !envFilePath.includes(DSH_CONSOLE_DIR);

      for (const key in parsedEnv) {
        if (Object.hasOwn(parsedEnv, key)) {
          // If it's a project .env file, skip loading excluded variables.
          if (isProjectEnvFile && excludedVars.includes(key)) {
            continue;
          }

          // Load variable only if it's not already set in the environment.
          if (!Object.hasOwn(process.env, key)) {
            process.env[key] = parsedEnv[key];
          }
        }
      }
    } catch (_e) {
      // Ignore errors (quiet mode)
    }
  }
}

/**
 * Loads settings from user and workspace directories.
 * Project settings override user settings.
 */
export function loadSettings(
  workspaceDir: string = process.cwd(),
): LoadedSettings {
  const settingsErrors: SettingsError[] = [];
  const systemSettingsPath = getSystemSettingsPath();
  const systemDefaultsPath = getSystemDefaultsPath();

  // Resolve paths to their canonical representation to handle symlinks
  const resolvedWorkspaceDir = path.resolve(workspaceDir);
  const resolvedHomeDir = path.resolve(homedir());

  let realWorkspaceDir = resolvedWorkspaceDir;
  try {
    // fs.realpathSync gets the "true" path, resolving any symlinks
    realWorkspaceDir = fs.realpathSync(resolvedWorkspaceDir);
  } catch (_e) {
    // This is okay. The path might not exist yet, and that's a valid state.
  }

  // We expect homedir to always exist and be resolvable.
  const realHomeDir = fs.realpathSync(resolvedHomeDir);

  const workspaceSettingsPath = new Storage(
    workspaceDir,
  ).getWorkspaceSettingsPath();

  const load = (filePath: string): { settings: Settings; rawJson?: string } => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const rawSettings: unknown = JSON.parse(stripJsonComments(content));

        if (
          typeof rawSettings !== 'object' ||
          rawSettings === null ||
          Array.isArray(rawSettings)
        ) {
          settingsErrors.push({
            message: 'Settings file is not a valid JSON object.',
            path: filePath,
            severity: 'error',
          });
          return { settings: {} };
        }

        const settingsObject = rawSettings as Record<string, unknown>;

        // Validate settings structure with Zod
        const validationResult = validateSettings(settingsObject);
        if (!validationResult.success && validationResult.error) {
          const errorMessage = formatValidationError(
            validationResult.error,
            filePath,
          );
          settingsErrors.push({
            message: errorMessage,
            path: filePath,
            severity: 'warning',
          });
        }

        return { settings: settingsObject, rawJson: content };
      }
    } catch (error: unknown) {
      settingsErrors.push({
        message: getErrorMessage(error),
        path: filePath,
        severity: 'error',
      });
    }
    return { settings: {} };
  };

  const systemResult = load(systemSettingsPath);
  const systemDefaultsResult = load(systemDefaultsPath);
  const userResult = load(USER_SETTINGS_PATH);

  let workspaceResult: { settings: Settings; rawJson?: string } = {
    settings: {},
    rawJson: undefined,
  };
  if (realWorkspaceDir !== realHomeDir) {
    workspaceResult = load(workspaceSettingsPath);
  }

  const systemOriginalSettings = structuredClone(systemResult.settings);
  const systemDefaultsOriginalSettings = structuredClone(
    systemDefaultsResult.settings,
  );
  const userOriginalSettings = structuredClone(userResult.settings);
  const workspaceOriginalSettings = structuredClone(workspaceResult.settings);

  // Environment variables for runtime use
  const systemSettings = resolveEnvVarsInObject(systemResult.settings);
  const systemDefaultSettings = resolveEnvVarsInObject(systemDefaultsResult.settings);
  const userSettings = resolveEnvVarsInObject(userResult.settings);
  const workspaceSettings = resolveEnvVarsInObject(workspaceResult.settings);

  // DSH owns tool approval. Local workspace settings are always loaded.
  const isTrusted = true;

  // Create a temporary merged settings object
  const tempMergedSettings = mergeSettings(
    systemSettings,
    systemDefaultSettings,
    userSettings,
    workspaceSettings,
    isTrusted,
  );

  // loadEnvironment depends on settings so we have to create a temp version of
  // the settings to avoid a cycle
  loadEnvironment(tempMergedSettings);

  // Check for any fatal errors before proceeding
  const fatalErrors = settingsErrors.filter((e) => e.severity === 'error');
  if (fatalErrors.length > 0) {
    const errorMessages = fatalErrors.map(
      (error) => `Error in ${error.path}: ${error.message}`,
    );
    throw new FatalConfigError(
      `${errorMessages.join('\n')}\nPlease fix the configuration file(s) and try again.`,
    );
  }

  return new LoadedSettings(
    {
      path: systemSettingsPath,
      settings: systemSettings,
      originalSettings: systemOriginalSettings,
      rawJson: systemResult.rawJson,
    },
    {
      path: systemDefaultsPath,
      settings: systemDefaultSettings,
      originalSettings: systemDefaultsOriginalSettings,
      rawJson: systemDefaultsResult.rawJson,
    },
    {
      path: USER_SETTINGS_PATH,
      settings: userSettings,
      originalSettings: userOriginalSettings,
      rawJson: userResult.rawJson,
    },
    {
      path: workspaceSettingsPath,
      settings: workspaceSettings,
      originalSettings: workspaceOriginalSettings,
      rawJson: workspaceResult.rawJson,
    },
    isTrusted,
    settingsErrors,
  );
}

export function saveSettings(settingsFile: SettingsFile): void {
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(settingsFile.path);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const settingsToSave = settingsFile.originalSettings;

    // Use the format-preserving update function
    updateSettingsFilePreservingFormat(
      settingsFile.path,
      settingsToSave,
    );
  } catch (error) {
    coreEvents.emitFeedback(
      'error',
      'There was an error saving your latest settings changes.',
      error,
    );
  }
}
