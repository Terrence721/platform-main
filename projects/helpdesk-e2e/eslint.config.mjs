import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

// Plain TypeScript run by Playwright, no Angular: the root config's
// TypeScript and module boundary rules, plus Playwright's recommended ones
// for the specs (an awaited expect, no test.only or fixed waits).
export default defineConfig(baseConfig, {
  files: ['src/**/*.spec.ts'],
  extends: [playwright.configs['flat/recommended']],
});
