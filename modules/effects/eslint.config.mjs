import tseslint from 'typescript-eslint';
import baseConfig, {
  angularTemplateConfig,
  angularTsConfig,
} from '../../eslint.config.mjs';

export default tseslint.config(
  {
    ignores: ['**/dist'],
  },
  baseConfig,
  {
    files: ['**/*.ts'],
    extends: [angularTsConfig],
    rules: {
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/prefer-standalone': 'off',
      // migrations/schematics import the shared modules/schematics-core
      // (a separate Nx project) via a relative path, not an npm-scoped
      // alias - required so the compiled require() bypasses the published
      // package.json's "exports" restriction, see docs/architecture.md.
      '@nx/enforce-module-boundaries': 'off',
      '@angular-eslint/prefer-inject': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: ['modules/effects/tsconfig.*.json'],
      },
    },
  },
  {
    files: ['testing/**/*.ts'],
    extends: [angularTsConfig],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: ['modules/effects/tsconfig.*.json'],
      },
    },
  },
  {
    files: ['**/*.html'],
    extends: [angularTemplateConfig],
  }
);
