import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Every module is a Vitest project, named after its Nx project. The value
 * holds that module's overrides of the shared settings below; none has any
 * today.
 */
const modules: Record<string, { testTimeout?: number }> = {
  component: {},
  'component-store': {},
  data: {},
  effects: {},
  entity: {},
  'eslint-plugin': {},
  operators: {},
  'router-store': {},
  schematics: {},
  'schematics-core': {},
  signals: {},
  store: {},
  'store-devtools': {},
};

/**
 * The repo's own tooling scripts (scripts/) are tested as one more project. It
 * is not an Nx project, so `nx test` never runs it; CI runs it with
 * `yarn test:scripts`.
 */
const scriptsProject = 'scripts';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Which project to run, when the run is scoped to one:
 * - Nx sets NX_TASK_TARGET_PROJECT for every task, so `nx test <module>` runs
 *   only that module even though the executor starts Vitest from the
 *   workspace root.
 * - Otherwise, a run started from inside a module folder
 *   (`cd modules/signals && npx vitest run`) is scoped to that module, and
 *   one started from inside scripts/ to the scripts project.
 * A run from the workspace root (`yarn test:report`, the VS Code Testing
 * panel) covers every module and the scripts.
 */
function scopedProject(): string | undefined {
  const fromNx = process.env['NX_TASK_TARGET_PROJECT'];
  if (fromNx && fromNx in modules) return fromNx;

  const normalize = (path: string) => path.replace(/\\/g, '/');
  const relative = normalize(process.cwd()).replace(
    normalize(workspaceRoot),
    ''
  );
  if (/^scripts(\/|$)/.test(relative)) return scriptsProject;

  const match = /^modules\/([^/]+)/.exec(relative);
  return match && match[1] in modules ? match[1] : undefined;
}

/**
 * Single Vitest configuration for the whole workspace. All modules share the
 * settings below; each one becomes a project rooted at its own folder, so
 * per-module files (setup file, tsconfig.spec.json) resolve as before.
 */
export default defineConfig(({ mode }) => {
  const only = scopedProject();

  return {
    plugins: [
      angular(),
      // Resolves the @ngrx/* path aliases from the ROOT tsconfig.json for every
      // importing file. Pointed at that file explicitly: each module's own
      // tsconfig.json has `include: []`, and files in secondary entry points
      // (e.g. signals/events, store/testing) have no tsconfig with the aliases
      // nearby, so per-file tsconfig discovery - including Vite's native
      // resolve.tsconfigPaths - leaves them unresolved.
      // (Replaces the deprecated nxViteTsPaths, removed in Nx v24.)
      tsconfigPaths({
        root: workspaceRoot,
        projects: [fileURLToPath(new URL('./tsconfig.json', import.meta.url))],
      }),
    ],
    resolve: {
      // Vite's default extension-resolution order checks .js before .ts, so
      // any stray compiled .js sibling (e.g. a stale local tsc/typecheck
      // output) silently shadows the real .ts source for an extensionless
      // import. .ts is the only real source of truth in this repo - always
      // resolve it first, regardless of what stale build output exists on
      // disk.
      extensions: ['.ts', '.mts', '.mjs', '.js', '.jsx', '.tsx', '.json'],
    },
    define: {
      'import.meta.vitest': mode !== 'production',
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
      // Reports are only for a whole-workspace run: a run scoped to one module
      // (`nx test <module>`) keeps the default reporter, as it always did.
      reporters: only
        ? ['default']
        : [
            'default',
            ['html', { outputFile: './test-results/index.html' }],
            // Plain JSON alongside the interactive report - scripts/generate-
            // test-summary.ts reads this to render the pie-chart summary page,
            // rather than decoding the html reporter's flatted-serialized data.
            ['json', { outputFile: './test-results/results.json' }],
          ],
      projects: [
        ...Object.entries(modules)
          .filter(([name]) => !only || name === only)
          .map(([name, overrides]) => ({
            extends: true,
            root: fileURLToPath(new URL(`./modules/${name}`, import.meta.url)),
            test: { name, ...overrides },
          })),
        ...(!only || only === scriptsProject
          ? [
              {
                // Deliberately not `extends: true`: plain Node tooling needs none
                // of the shared Angular plugins, setup file or type tests, and an
                // inherited array such as setupFiles cannot be emptied again.
                root: fileURLToPath(new URL('./scripts', import.meta.url)),
                test: { name: scriptsProject, environment: 'node' },
              },
            ]
          : []),
      ],
    },
  };
});
