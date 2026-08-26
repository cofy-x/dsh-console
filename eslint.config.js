/**
 * @license
 * Copyright 2025 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import nodePlugin from 'eslint-plugin-n';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';
import headers from 'eslint-plugin-headers';
import path from 'node:path';
import url from 'node:url';

// --- ESM way to get __dirname ---
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- ---

// Determine the monorepo root (assuming eslint.config.js is at the root)
const projectRoot = __dirname;

export default tseslint.config(
  {
    // Global ignores
    ignores: [
      'node_modules/*',
      '.integration-tests/**',
      'eslint.config.js',
      'packages/**/dist/**',
      'apps/**/dist/**',
      'dist/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      ...eslintReact.configs['recommended-typescript'].plugins,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@eslint-react/no-direct-mutation-state': 'error',
      '@eslint-react/no-missing-key': 'error',
      '@eslint-react/jsx-no-children-prop': 'error',
      '@eslint-react/jsx-no-comment-textnodes': 'error',
      '@eslint-react/dom-no-render-return-value': 'error',
      '@eslint-react/dom-no-void-elements-with-children': 'error',
    },
  },
  {
    // ESLint 10 and typescript-eslint surface additional legacy cleanup.
    // Keep it visible without coupling broad source rewrites to tool upgrades.
    rules: {
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
  {
    // Import specific config for CLI package
    files: ['apps/cli/src/**/*.{ts,tsx}'],
    plugins: {
      'import-x': importX,
    },
    rules: {
      ...importX.flatConfigs.recommended.rules,
      ...importX.flatConfigs.typescript.rules,
      'import-x/no-default-export': 'warn',
      'import-x/no-unresolved': 'off', // Disable for now, can be noisy with monorepos/paths
    },
  },
  {
    // General overrides and rules for all packages (TS/TSX files)
    files: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
    plugins: {
      'import-x': importX,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: projectRoot,
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // General Best Practice Rules (subset adapted for flat config)
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      'arrow-body-style': ['error', 'as-needed'],
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as' },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-inferrable-types': [
        'error',
        { ignoreParameters: true, ignoreProperties: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Prevent async errors from bypassing catch handlers
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      'import-x/no-internal-modules': [
        'error',
        {
          allow: [
            'react-dom/test-utils',
            '@astrojs/starlight/loaders',
            '@astrojs/starlight/schema',
            'memfs/lib/volume.js',
            'yargs/**',
            'msw/node',
          ],
        },
      ],
      'import-x/no-relative-packages': 'error',
      'no-cond-assign': 'error',
      'no-debugger': 'error',
      'no-duplicate-case': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="require"]',
          message: 'Avoid using require(). Use ES6 imports instead.',
        },
        {
          selector: 'ThrowStatement > Literal:not([value=/^\\w+Error:/])',
          message:
            'Do not throw string literals or non-Error objects. Throw new Error("...") instead.',
        },
      ],
      'no-unsafe-finally': 'error',
      'no-unused-expressions': 'off', // Disable base rule
      '@typescript-eslint/no-unused-expressions': [
        // Enable TS version
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      'no-var': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      'prefer-arrow-callback': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      radix: 'error',
      'no-console': 'error',
      'default-case': 'error',
      '@typescript-eslint/await-thenable': ['error'],
      '@typescript-eslint/no-floating-promises': ['error'],
      '@typescript-eslint/no-unnecessary-type-assertion': ['warn'],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:os',
              importNames: ['homedir', 'tmpdir'],
              message:
                'Please use the helpers from @cofy-x/dsh-console-core instead of node:os homedir()/tmpdir() to ensure strict environment isolation.',
            },
            {
              name: 'os',
              importNames: ['homedir', 'tmpdir'],
              message:
                'Please use the helpers from @cofy-x/dsh-console-core instead of os homedir()/tmpdir() to ensure strict environment isolation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/react-core/src/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off', 
    },
  },
  {
    // Allow os.homedir() in tests and paths.ts where it is used to implement the helper
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'packages/core/src/utils/paths.ts',
      'packages/test-utils/src/**/*.ts',
      'scripts/**/*.js',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // The production tsconfig deliberately excludes tests. ESLint still checks
    // them against a dedicated project so type-aware rules remain available.
    files: ['apps/cli/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['./apps/cli/tsconfig.eslint.json'],
        tsconfigRootDir: projectRoot,
      },
    },
  },
  {
    // Prevent self-imports in packages
    files: ['packages/core/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: '@cofy-x/dsh-console-core',
          message: 'Please use relative imports within the @cofy-x/dsh-console-core package.',
        },
      ],
    },
  },
  {
    files: ['apps/cli/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: '@cofy-x/dsh-console',
          message: 'Please use relative imports within the @cofy-x/dsh-console package.',
        },
      ],
    },
  },
  {
    files: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/expect-expect': 'off',
      'vitest/no-commented-out-tests': 'off',
    },
  },
  {
    files: ['./**/*.{tsx,ts,js}'],
    plugins: {
      headers,
      'import-x': importX,
      n: nodePlugin,
    },
    rules: {
      'headers/header-format': [
        'error',
        {
          source: 'string',
          content: [
            '@license',
            'Copyright (year) (owner)',
            'SPDX-License-Identifier: Apache-2.0',
          ].join('\n'),
          patterns: {
            year: {
              pattern: '202[5-6]',
              defaultValue: '2026',
            },
            owner: {
              pattern: '(?:cofy-x|Google LLC)',
              defaultValue: 'cofy-x',
            },
          },
        },
      ],
      'n/prefer-node-protocol': 'error',
    },
  },
  // extra settings for scripts that we run directly with node
  {
    files: [
      './scripts/**/*.{js,mjs,cjs}',
      'apps/cli/bin/**/*.{js,mjs,cjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Examples should have access to standard globals like fetch
  {
    files: ['apps/cli/src/commands/extensions/examples/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
  },
  // Prettier config must be last
  prettierConfig,
  // extra settings for scripts that we run directly with node
  {
    files: ['./integration-tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
);
