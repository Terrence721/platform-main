import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';
import { join } from 'path';

// The help desk end to end (#986): the real app, API and PostgreSQL, run
// by Docker Compose as `docker compose --profile full up` runs them, and
// driven in Chromium. `src/stack.ts` starts the stack before the run and
// removes it after, unless E2E_BASE_URL names one already running.

const repoRoot = join(__dirname, '..', '..');
const output = join(
  repoRoot,
  'dist',
  '.playwright',
  'projects',
  'helpdesk-e2e'
);

// .env (copied from .env.example) can move the app off 8088; Docker
// Compose reads the same file, so both agree.
const envFile = join(repoRoot, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

/** Where the app is: one already running, or the stack's nginx. */
const BASE_URL =
  process.env['E2E_BASE_URL'] ??
  `http://localhost:${process.env['HELPDESK_APP_PORT'] ?? '8088'}`;

const inCi = process.env['CI'] !== undefined;

export default defineConfig({
  testDir: './src',
  outputDir: join(output, 'test-output'),
  globalSetup: './src/stack.ts',
  // The tests share one database, and some change it: one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: inCi,
  // A retry in CI keeps a trace of what went wrong; none locally, where a
  // failure should show at once.
  retries: inCi ? 1 : 0,
  reporter: [
    [inCi ? 'list' : 'line'],
    ['html', { outputFolder: join(output, 'report'), open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
