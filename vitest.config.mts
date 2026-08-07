import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

/**
 * Shared project configuration object.
 * Projects should merge this into their local 'defineProject' call.
 */
export const baseConfig = {
  plugins: [angular(), nxViteTsPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    include: ['**/*.{spec,test}.ts'],
    passWithNoTests: true,
    setupFiles: ['test-setup.ts'],
    testTimeout: 30000,
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
