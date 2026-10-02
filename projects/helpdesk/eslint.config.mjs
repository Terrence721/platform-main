import ngrx from '@ngrx/eslint-plugin';
import { defineConfig } from 'eslint/config';
import baseConfig, {
  angularTemplateConfig,
  angularTsConfig,
} from '../../eslint.config.mjs';

export default defineConfig(
  baseConfig,
  {
    files: ['**/*.ts'],
    extends: [angularTsConfig],
    rules: {
      // An app, unlike the modules, keeps the Angular selector and OnPush rules.
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'hd', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'hd', style: 'camelCase' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
    },
    languageOptions: {
      parserOptions: {
        project: ['projects/helpdesk/tsconfig.*.json'],
      },
    },
  },
  {
    // Every NgRx rule, including those that need type information, which
    // the block above provides. Scoped to TypeScript: the config itself
    // applies to every file.
    files: ['**/*.ts'],
    extends: [ngrx.configs.allTypeChecked],
  },
  {
    files: ['**/*.html'],
    extends: [angularTemplateConfig, ngrx.configs.component],
    rules: {
      // Opt-in: use ngrxPush instead of the async pipe in templates.
      '@ngrx/prefer-ngrx-push': 'error',
    },
  }
);
