import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

/**
 * Shared project configuration object.
 * Projects should merge this into their local 'defineProject' call.
 */
export const baseConfig = {
  plugins: [angular(), nxViteTsPaths()],
  resolve: {
    // Vite's default extension-resolution order checks .js before .ts, so
    // any stray compiled .js sibling (e.g. a stale local tsc/typecheck
    // output) silently shadows the real .ts source for an extensionless
    // import. .ts is the only real source of truth in this repo - always
    // resolve it first, regardless of what stale build output exists on
    // disk.
    extensions: ['.ts', '.mts', '.mjs', '.js', '.jsx', '.tsx', '.json'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    include: ['**/*.{spec,test}.ts'],
    passWithNoTests: true,
    setupFiles: ['test-setup.ts'],
    // A ceiling for hung tests, not a performance gate. The slow tests here
    // (spec/types/**, which start a TypeScript compiler per file) take ~12s on
    // a quiet machine but measured 2.5x+ slower in the VS Code Testing panel
    // (watch mode, VS Code's own runtime, all modules competing for memory),
    // where a 30s limit was still being hit.
    testTimeout: 60000,
    // How long a finished forks worker may take to exit before Vitest logs
    // "[vitest-pool]: Timeout terminating forks worker". Same reasoning: the
    // default (10s) is too short for a loaded panel run, and the tests have
    // already passed by then, so it only produced noise.
    teardownTimeout: 30000,
    // Default (300ms) flags nearly every compile-time type-assertion test
    // (spec/types/**, invokes tsc/vue-tsc) and every schematics/migrations
    // test (SchematicTestRunner does real Tree/filesystem I/O) as "slow" -
    // that's inherent to how those tests work, not a regression. 2000ms
    // keeps the signal meaningful for genuine runtime perf issues instead.
    slowTestThreshold: 2000,
    typecheck: {
      enabled: true,
      ignoreSourceErrors: true,
      include: ['**/*.{spec,test}.ts', '**/*.test-d.ts'],
      tsconfig: './tsconfig.spec.json',
    },
  },
};

/**
 * Root Vitest configuration.
 * Delegates to the individual project configuration files.
 */
export default defineConfig({
  test: {
    projects: ['modules/*/vitest.config.mts', 'projects/*/vitest.config.mts'],
    reporters: [
      'default',
      ['html', { outputFile: './test-results/index.html' }],
      // Plain JSON alongside the interactive report - scripts/generate-
      // test-summary.ts reads this to render the pie-chart summary page,
      // rather than decoding the html reporter's flatted-serialized data.
      ['json', { outputFile: './test-results/results.json' }],
    ],
    // The html reporter's dashboard "Slow" stat is computed client-side
    // against this single root-level value, not each project's own
    // (merged-from-baseConfig) threshold - see the comment above baseConfig.
    // Setting it only in baseConfig has no effect on the aggregated report.
    slowTestThreshold: 2000,
  },
});
