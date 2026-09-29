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
    name: 'ngrx/effects-type-checked',
    languageOptions: {
      parser,
    },
    rules: {
      '@ngrx/avoid-cyclic-effects': 'error',
      '@ngrx/no-dispatch-in-effects': 'error',
      '@ngrx/no-effects-in-providers': 'error',
      '@ngrx/no-multiple-actions-in-effects': 'error',
      '@ngrx/prefer-action-creator-in-of-type': 'error',
      '@ngrx/prefer-effect-callback-in-block-statement': 'error',
      '@ngrx/use-effects-lifecycle-interface': 'error',
    },
  },
];
