/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MergeStrategy,
  oneLine,
  type SettingEnumOption,
  type SettingsSchema,
} from './settings-types.js';
import type { CustomTheme } from '../ui/theme/types.js';

export type DnsResolutionOrder = 'ipv4first' | 'verbatim';

const EMPTY_CUSTOM_THEMES: Record<string, CustomTheme> = {};

const SETTINGS_SCHEMA = {
  general: {
    type: 'object',
    label: 'General',
    category: 'General',
    requiresRestart: false,
    default: {},
    description: 'General application settings.',
    showInDialog: false,
    properties: {
      preferredEditor: {
        type: 'string',
        label: 'Preferred Editor',
        category: 'General',
        requiresRestart: false,
        default: undefined as string | undefined,
        description: 'The preferred editor to open files in.',
        showInDialog: false,
      },
      vimMode: {
        type: 'boolean',
        label: 'Vim Mode',
        category: 'General',
        requiresRestart: false,
        default: false,
        description: 'Enable Vim keybindings',
        showInDialog: true,
      },
      enablePromptCompletion: {
        type: 'boolean',
        label: 'Enable Prompt Completion',
        category: 'General',
        requiresRestart: true,
        default: false,
        description:
          'Enable AI-powered prompt completion suggestions while typing.',
        showInDialog: true,
      },
      debugKeystrokeLogging: {
        type: 'boolean',
        label: 'Debug Keystroke Logging',
        category: 'General',
        requiresRestart: false,
        default: false,
        description:
          'Log raw terminal input and parsed keys locally for diagnostics. Prompt, paste, and shell content may be included; credential dialogs are always redacted.',
        showInDialog: true,
      },
    },
  },
  ui: {
    type: 'object',
    label: 'UI',
    category: 'UI',
    requiresRestart: false,
    default: {},
    description: 'User interface settings.',
    showInDialog: false,
    properties: {
      theme: {
        type: 'string',
        label: 'Theme',
        category: 'UI',
        requiresRestart: false,
        default: undefined as string | undefined,
        description:
          'The color theme for the UI. See the CLI themes guide for available options.',
        showInDialog: false,
      },
      customThemes: {
        type: 'object',
        label: 'Custom Themes',
        category: 'UI',
        requiresRestart: false,
        default: EMPTY_CUSTOM_THEMES,
        description: 'Custom theme definitions.',
        showInDialog: false,
        additionalProperties: {
          type: 'object',
          ref: 'CustomTheme',
        },
      },
      hideWindowTitle: {
        type: 'boolean',
        label: 'Hide Window Title',
        category: 'UI',
        requiresRestart: true,
        default: false,
        description: 'Hide the window title bar',
        showInDialog: true,
      },
      reasoningDisplay: {
        type: 'enum',
        label: 'Reasoning',
        category: 'UI',
        requiresRestart: false,
        default: 'auto',
        description:
          'Choose the default reasoning visibility. Individual blocks can be toggled by click.',
        showInDialog: true,
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'expanded', label: 'Expanded' },
          { value: 'hidden', label: 'Hidden' },
        ] satisfies readonly SettingEnumOption[],
      },
      dynamicWindowTitle: {
        type: 'boolean',
        label: 'Dynamic Window Title',
        category: 'UI',
        requiresRestart: false,
        default: true,
        description:
          'Update the terminal window title with current status icons (Ready: ◇, Action Required: ✋, Working: ✦)',
        showInDialog: true,
      },
      showHomeDirectoryWarning: {
        type: 'boolean',
        label: 'Show Home Directory Warning',
        category: 'UI',
        requiresRestart: true,
        default: true,
        description:
          'Show a warning when running DSH Console in the home directory.',
        showInDialog: true,
      },
      hideTips: {
        type: 'boolean',
        label: 'Hide Tips',
        category: 'UI',
        requiresRestart: false,
        default: false,
        description: 'Hide helpful tips in the UI',
        showInDialog: true,
      },
      footer: {
        type: 'object',
        label: 'Footer',
        category: 'UI',
        requiresRestart: false,
        default: {},
        description: 'Settings for the footer.',
        showInDialog: false,
        properties: {
          hideCWD: {
            type: 'boolean',
            label: 'Hide CWD',
            category: 'UI',
            requiresRestart: false,
            default: false,
            description:
              'Hide the current working directory path in the footer.',
            showInDialog: true,
          },
          hideModelInfo: {
            type: 'boolean',
            label: 'Hide Model Info',
            category: 'UI',
            requiresRestart: false,
            default: false,
            description: 'Hide the model name and context usage in the footer.',
            showInDialog: true,
          },
        },
      },
      hideFooter: {
        type: 'boolean',
        label: 'Hide Footer',
        category: 'UI',
        requiresRestart: false,
        default: false,
        description: 'Hide the footer from the UI',
        showInDialog: true,
      },
      showMemoryUsage: {
        type: 'boolean',
        label: 'Show Memory Usage',
        category: 'UI',
        requiresRestart: false,
        default: false,
        description: 'Display memory usage information in the UI',
        showInDialog: true,
      },
      showLineNumbers: {
        type: 'boolean',
        label: 'Show Line Numbers',
        category: 'UI',
        requiresRestart: false,
        default: true,
        description: 'Show line numbers in the chat.',
        showInDialog: true,
      },
      useAlternateBuffer: {
        type: 'boolean',
        label: 'Use Alternate Screen Buffer',
        category: 'UI',
        requiresRestart: true,
        default: false,
        description:
          'Use an alternate screen buffer for the UI, preserving shell history.',
        showInDialog: true,
      },
      useBackgroundColor: {
        type: 'boolean',
        label: 'Use Background Color',
        category: 'UI',
        requiresRestart: false,
        default: true,
        description: 'Whether to use background colors in the UI.',
        showInDialog: true,
      },
      incrementalRendering: {
        type: 'boolean',
        label: 'Incremental Rendering',
        category: 'UI',
        requiresRestart: true,
        default: true,
        description:
          'Enable incremental rendering for the UI. This option will reduce flickering but may cause rendering artifacts. Only supported when useAlternateBuffer is enabled.',
        showInDialog: true,
      },
      showSpinner: {
        type: 'boolean',
        label: 'Show Spinner',
        category: 'UI',
        requiresRestart: false,
        default: true,
        description: 'Show the spinner during operations.',
        showInDialog: true,
      },
      customWittyPhrases: {
        type: 'array',
        label: 'Custom Witty Phrases',
        category: 'UI',
        requiresRestart: false,
        default: [] as string[],
        description: oneLine`
          Custom witty phrases to display during loading.
          When provided, the CLI cycles through these instead of the defaults.
        `,
        showInDialog: false,
        items: { type: 'string' },
      },
      accessibility: {
        type: 'object',
        label: 'Accessibility',
        category: 'UI',
        requiresRestart: true,
        default: {},
        description: 'Accessibility settings.',
        showInDialog: false,
        properties: {
          enableLoadingPhrases: {
            type: 'boolean',
            label: 'Enable Loading Phrases',
            category: 'UI',
            requiresRestart: true,
            default: true,
            description: 'Enable loading phrases during operations.',
            showInDialog: true,
          },
          screenReader: {
            type: 'boolean',
            label: 'Screen Reader Mode',
            category: 'UI',
            requiresRestart: true,
            default: false,
            description:
              'Render output in plain-text to be more screen reader accessible',
            showInDialog: true,
          },
        },
      },
      header: {
        type: 'object',
        label: 'Header',
        category: 'UI',
        requiresRestart: false,
        default: {},
        description: 'Header display settings.',
        showInDialog: false,
        properties: {
          layout: {
            type: 'enum',
            label: 'Header Layout',
            category: 'UI',
            requiresRestart: false,
            default: 'horizontal',
            description:
              'Choose the header layout: "horizontal" for art + text side by side, "vertical" for stacked layout.',
            showInDialog: true,
            options: [
              {
                value: 'horizontal',
                label: 'Horizontal (art + text side by side)',
              },
              { value: 'vertical', label: 'Vertical (stacked)' },
            ],
          },
          artResourceType: {
            type: 'enum',
            label: 'Art Resource Type',
            category: 'UI',
            requiresRestart: false,
            default: 'pokemon',
            description:
              'The type of ASCII art resources to display in horizontal layout.',
            showInDialog: true,
            options: [
              { value: 'pokemon', label: 'Pokefetch Pokémon' },
              { value: 'custom', label: 'Custom Directory' },
            ],
          },
          artResourcesPath: {
            type: 'string',
            label: 'Art Resources Path',
            category: 'UI',
            requiresRestart: false,
            default: undefined as string | undefined,
            description:
              'Custom path to art resources directory (used when artResourceType is "custom"). Relative to CWD or absolute path.',
            showInDialog: false,
          },
          customAsciiArtPath: {
            type: 'string',
            label: 'Custom ASCII Art Path',
            category: 'UI',
            requiresRestart: false,
            default: undefined as string | undefined,
            description:
              'Path to a single custom ASCII art file (e.g., ".dsh-console/logo.txt"). When set, overrides other art settings.',
            showInDialog: false,
          },
        },
      },
    },
  },

  context: {
    type: 'object',
    label: 'Context',
    category: 'Context',
    requiresRestart: false,
    default: {},
    description: 'Settings for managing context provided to the model.',
    showInDialog: false,
    properties: {
      fileFiltering: {
        type: 'object',
        label: 'File Filtering',
        category: 'Context',
        requiresRestart: true,
        default: {},
        description: 'Settings for git-aware file filtering.',
        showInDialog: false,
        properties: {
          respectGitIgnore: {
            type: 'boolean',
            label: 'Respect .gitignore',
            category: 'Context',
            requiresRestart: true,
            default: true,
            description: 'Respect .gitignore files when searching.',
            showInDialog: true,
          },
          respectDshConsoleIgnore: {
            type: 'boolean',
            label: 'Respect .dsh-consoleignore',
            category: 'Context',
            requiresRestart: true,
            default: true,
            description: 'Respect .dsh-consoleignore files when searching.',
            showInDialog: true,
          },
          enableRecursiveFileSearch: {
            type: 'boolean',
            label: 'Enable Recursive File Search',
            category: 'Context',
            requiresRestart: true,
            default: true,
            description: oneLine`
              Enable recursive file search functionality when completing @ references in the prompt.
            `,
            showInDialog: true,
          },
          enableFuzzySearch: {
            type: 'boolean',
            label: 'Enable Fuzzy Search',
            category: 'Context',
            requiresRestart: true,
            default: true,
            description: 'Enable fuzzy search when searching for files.',
            showInDialog: true,
          },
        },
      },
    },
  },

  tools: {
    type: 'object',
    label: 'Tools',
    category: 'Tools',
    requiresRestart: true,
    default: {},
    description: 'Settings for built-in and custom tools.',
    showInDialog: false,
    properties: {
      shell: {
        type: 'object',
        label: 'Shell',
        category: 'Tools',
        requiresRestart: false,
        default: {},
        description: 'Settings for shell execution.',
        showInDialog: false,
        properties: {
          enableInteractiveShell: {
            type: 'boolean',
            label: 'Enable Interactive Shell',
            category: 'Tools',
            requiresRestart: true,
            default: true,
            description: oneLine`
              Use node-pty for an interactive shell experience.
              Fallback to child_process still applies.
            `,
            showInDialog: true,
          },
          pager: {
            type: 'string',
            label: 'Pager',
            category: 'Tools',
            requiresRestart: false,
            default: 'cat',
            description:
              'The pager command to use for shell output. Defaults to `cat`.',
            showInDialog: false,
          },
          showColor: {
            type: 'boolean',
            label: 'Show Color',
            category: 'Tools',
            requiresRestart: false,
            default: false,
            description: 'Show color in shell output.',
            showInDialog: true,
          },
        },
      },
    },
  },

  security: {
    type: 'object',
    label: 'Security',
    category: 'Security',
    requiresRestart: true,
    default: {},
    description: 'Security-related settings.',
    showInDialog: false,
    properties: {
      environmentVariableRedaction: {
        type: 'object',
        label: 'Environment Variable Redaction',
        category: 'Security',
        requiresRestart: false,
        default: {},
        description: 'Settings for environment variable redaction.',
        showInDialog: false,
        properties: {
          allowed: {
            type: 'array',
            label: 'Allowed Environment Variables',
            category: 'Security',
            requiresRestart: true,
            default: [] as string[],
            description:
              'Environment variables to always allow (bypass redaction).',
            showInDialog: false,
            items: { type: 'string' },
          },
          blocked: {
            type: 'array',
            label: 'Blocked Environment Variables',
            category: 'Security',
            requiresRestart: true,
            default: [] as string[],
            description: 'Environment variables to always redact.',
            showInDialog: false,
            items: { type: 'string' },
          },
          enabled: {
            type: 'boolean',
            label: 'Enable Environment Variable Redaction',
            category: 'Security',
            requiresRestart: true,
            default: false,
            description:
              'Enable redaction of environment variables that may contain secrets.',
            showInDialog: true,
          },
        },
      },
    },
  },

  advanced: {
    type: 'object',
    label: 'Advanced',
    category: 'Advanced',
    requiresRestart: true,
    default: {},
    description: 'Advanced settings for power users.',
    showInDialog: false,
    properties: {
      dnsResolutionOrder: {
        type: 'string',
        label: 'DNS Resolution Order',
        category: 'Advanced',
        requiresRestart: true,
        default: undefined as DnsResolutionOrder | undefined,
        description: 'The DNS resolution order.',
        showInDialog: false,
      },
      excludedEnvVars: {
        type: 'array',
        label: 'Excluded Project Environment Variables',
        category: 'Advanced',
        requiresRestart: false,
        default: ['DEBUG', 'DEBUG_MODE'] as string[],
        description: 'Environment variables to exclude from project context.',
        showInDialog: false,
        items: { type: 'string' },
        mergeStrategy: MergeStrategy.UNION,
      },
    },
  },

  experimental: {
    type: 'object',
    label: 'Experimental',
    category: 'Experimental',
    requiresRestart: true,
    default: {},
    description: 'Setting to enable experimental features',
    showInDialog: false,
    properties: {
      useOSC52Paste: {
        type: 'boolean',
        label: 'Use OSC 52 Paste',
        category: 'Experimental',
        requiresRestart: false,
        default: false,
        description:
          'Use OSC 52 sequence for pasting instead of clipboardy (useful for remote sessions).',
        showInDialog: true,
      },
    },
  },
} as const satisfies SettingsSchema;

export type SettingsSchemaType = typeof SETTINGS_SCHEMA;

export type SettingsJsonSchemaDefinition = Record<string, unknown>;

export const SETTINGS_SCHEMA_DEFINITIONS: Record<
  string,
  SettingsJsonSchemaDefinition
> = {
  CustomTheme: {
    type: 'object',
    description:
      'Custom theme definition used for styling DSH Console output. Colors are provided as hex strings or named ANSI colors.',
    additionalProperties: false,
    properties: {
      type: {
        type: 'string',
        enum: ['custom'],
        default: 'custom',
      },
      name: {
        type: 'string',
        description: 'Theme display name.',
      },
      text: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primary: { type: 'string' },
          secondary: { type: 'string' },
          link: { type: 'string' },
          accent: { type: 'string' },
        },
      },
      background: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primary: { type: 'string' },
          diff: {
            type: 'object',
            additionalProperties: false,
            properties: {
              added: { type: 'string' },
              removed: { type: 'string' },
            },
          },
        },
      },
      border: {
        type: 'object',
        additionalProperties: false,
        properties: {
          default: { type: 'string' },
          focused: { type: 'string' },
        },
      },
      ui: {
        type: 'object',
        additionalProperties: false,
        properties: {
          comment: { type: 'string' },
          symbol: { type: 'string' },
          gradient: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      status: {
        type: 'object',
        additionalProperties: false,
        properties: {
          error: { type: 'string' },
          success: { type: 'string' },
          warning: { type: 'string' },
        },
      },
      Background: { type: 'string' },
      Foreground: { type: 'string' },
      LightBlue: { type: 'string' },
      AccentBlue: { type: 'string' },
      AccentPurple: { type: 'string' },
      AccentCyan: { type: 'string' },
      AccentGreen: { type: 'string' },
      AccentYellow: { type: 'string' },
      AccentRed: { type: 'string' },
      DiffAdded: { type: 'string' },
      DiffRemoved: { type: 'string' },
      Comment: { type: 'string' },
      Gray: { type: 'string' },
      DarkGray: { type: 'string' },
      GradientColors: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['type', 'name'],
  },
  BooleanOrString: {
    description: 'Accepts either a boolean flag or a string command name.',
    anyOf: [{ type: 'boolean' }, { type: 'string' }],
  },
};

export function getSettingsSchema(): SettingsSchemaType {
  return SETTINGS_SCHEMA;
}

type InferSettings<T extends SettingsSchema> = {
  -readonly [K in keyof T]?: T[K] extends { properties: SettingsSchema }
    ? InferSettings<T[K]['properties']>
    : T[K]['type'] extends 'enum'
      ? T[K]['options'] extends readonly SettingEnumOption[]
        ? T[K]['options'][number]['value']
        : T[K]['default']
      : T[K]['default'] extends boolean
        ? boolean
        : T[K]['default'];
};

type InferMergedSettings<T extends SettingsSchema> = {
  -readonly [K in keyof T]-?: T[K] extends { properties: SettingsSchema }
    ? InferMergedSettings<T[K]['properties']>
    : T[K]['type'] extends 'enum'
      ? T[K]['options'] extends readonly SettingEnumOption[]
        ? T[K]['options'][number]['value']
        : T[K]['default']
      : T[K]['default'] extends boolean
        ? boolean
        : T[K]['default'];
};

export type Settings = InferSettings<SettingsSchemaType>;
export type MergedSettings = InferMergedSettings<SettingsSchemaType>;
