import { defineConfig } from 'eslint/config';
import baseConfig, {
  angularTemplateConfig,
  angularTsConfig,
} from '../../eslint.config.mjs';

export default defineConfig(
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
      '@angular-eslint/prefer-inject': 'off',
      // migrations import the shared modules/schematics-core
      // (a separate Nx project) via a relative path, not an npm-scoped
      // alias - required so the compiled require() bypasses the published
      // package.json's "exports" restriction, see docs/architecture.md.
      '@nx/enforce-module-boundaries': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: ['modules/router-store/tsconfig.*.json'],
      },
    },
  },
  {
    // The data-persistence secondary entry point has its own tsconfigs, as
    // store/testing does: the module's own ones do not include its sources.
    // Extending angularTsConfig again re-enables its rules for these files,
    // so the module's overrides above are repeated here.
    files: ['data-persistence/**/*.ts'],
    extends: [angularTsConfig],
    rules: {
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@nx/enforce-module-boundaries': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: ['modules/router-store/data-persistence/tsconfig.*.json'],
      },
    },
  },
  {
    files: ['**/*.html'],
    extends: [angularTemplateConfig],
  }
);
