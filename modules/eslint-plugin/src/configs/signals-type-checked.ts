/**
 * DO NOT EDIT
 * This file is generated
 *
 * Includes rules that need type information: add parserOptions for it,
 * or ESLint fails with "You have used a rule which requires type
 * information". For example:
 *   {
 *     languageOptions: {
 *       parserOptions: {
 *         projectService: true,
 *         tsconfigRootDir: import.meta.dirname,
 *       },
 *     },
 *   }
 */

import type { TSESLint } from '@typescript-eslint/utils';

export default (
  plugin: TSESLint.FlatConfig.Plugin,
  parser: TSESLint.FlatConfig.Parser
): TSESLint.FlatConfig.ConfigArray => [
  {
    name: 'ngrx/base',
    languageOptions: {
      parser,
    },
    plugins: {
      '@ngrx': plugin,
    },
  },
  {
    name: 'ngrx/signals-type-checked',
    languageOptions: {
      parser,
    },
    rules: {
      '@ngrx/enforce-type-call': 'error',
      '@ngrx/prefer-protected-state': 'error',
      '@ngrx/signal-state-no-arrays-at-root-level': 'error',
      '@ngrx/signal-store-feature-should-use-generic-type': 'error',
      '@ngrx/with-state-no-arrays-at-root-level': 'error',
    },
  },
];
