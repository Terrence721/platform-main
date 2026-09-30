/**
 * DO NOT EDIT
 * This file is generated
 *
 * Lints Angular templates (the .html files) and needs
 * `@angular-eslint/template-parser` installed. For inline templates, also
 * run angular-eslint's `processInlineTemplates` processor on .ts files.
 */

import type { TSESLint } from '@typescript-eslint/utils';

export default (
  plugin: TSESLint.FlatConfig.Plugin,
  parser: TSESLint.FlatConfig.Parser
): TSESLint.FlatConfig.ConfigArray => [
  {
    name: 'ngrx/base',
    plugins: {
      '@ngrx': plugin,
    },
  },
  {
    name: 'ngrx/component',
    files: ['**/*.html'],
    languageOptions: {
      parser,
    },
    rules: {
      '@ngrx/no-async-pipe-in-ngrx-let': 'error',
    },
  },
];
