import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import type { Vitest } from 'vitest/node';

const workspaceRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Advisories that repeat on every run, have no option to turn them off, and
 * need no action. Each one is dropped from stderr (whole write, as it arrives);
 * everything else written to stderr passes through untouched. Remove an entry
 * if its advisory is ever removed upstream or wanted.
 * - Vitest prints "Testing types with tsc and vue-tsc is an experimental
 *   feature" once per project whenever `typecheck` is enabled. The type tests
 *   (`expectTypeOf`, `@ts-expect-error`) need typecheck, so it stays on.
 * - Vite 8 advises replacing vite-tsconfig-paths with its native
 *   resolve.tsconfigPaths, once per project. The plugin stays; see below.
 * - The Angular plugin looks for ./tsconfig.spec.json in the root config too,
 *   whose root is the workspace root, which has none and runs no tests. Only
 *   that path is dropped: a module whose own tsconfig.spec.json is missing is
 *   still reported.
 */
const advisories = [
  'Testing types with tsc and vue-tsc is an experimental feature',
  'The plugin "vite-tsconfig-paths" is detected',
  `Unable to resolve tsconfig at ${join(workspaceRoot, 'tsconfig.spec.json')}.`,
];
const advisoryFilter = Symbol.for('ngrx.vitest.typecheckAdvisoryFilter');
const stderr = process.stderr as NodeJS.WriteStream & {
  [advisoryFilter]?: true;
};
if (!stderr[advisoryFilter]) {
  // A config can be evaluated more than once in one process; wrap only once.
  stderr[advisoryFilter] = true;
  const write = stderr.write.bind(stderr) as (...args: unknown[]) => boolean;
  stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
    // Case-insensitive: the drive letter's case varies with how the run began.
    const text = String(chunk).toLowerCase();
    if (advisories.some((advisory) => text.includes(advisory.toLowerCase()))) {
      // Still honour a write callback, or a caller waiting on it would hang.
      const callback = rest.find((arg) => typeof arg === 'function') as
        (() => void) | undefined;
      callback?.();
      return true;
    }
    return write(chunk, ...rest);
  }) as typeof stderr.write;
}

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
 * True when the VS Code Vitest extension runs the tests: it starts its worker
 * with VITEST_VSCODE=true. The Testing panel runs every module at once in
 * watch mode, and on top of the test workers the typecheck pass starts one
 * `tsc` per module, which starved the compiler-API type specs past their
 * timeout and piped enough output streams into the worker to trigger Node's
 * MaxListenersExceededWarning. The panel therefore gets fewer workers and no
 * separate tsc pass; the CLI and CI keep both, so type errors are still caught
 * there.
 */
const inTestingPanel = process.env['VITEST_VSCODE'] === 'true';

/*
 * Vitest pipes every forks worker's stdout/stderr into its own and raises
 * their listener limit by one per worker, lowering it again only once a
 * stopped worker's output has flushed. Under load (seen in the panel, whose
 * output goes to a socket to VS Code) flushing lags, so stopping workers pile
 * up past the limit and Node logs "MaxListenersExceededWarning ... listeners
 * added to [Socket]" (harmless: the limit is bookkeeping, not a leak). A higher
 * base leaves room for that; Vitest adjusts relative to it. Not 0 (unlimited):
 * Vitest would then raise it to 1.
 */
for (const stream of [process.stdout, process.stderr]) {
  stream.setMaxListeners(stream.getMaxListeners() + 50);
}

/**
 * The VS Code Vitest extension (1.52.1) still calls
 * `experimental_parseSpecifications`, which Vitest 5 deprecated: it prints
 * "DEPRECATED ... Use parseSpecifications instead" to the panel on every
 * collection, then calls `parseSpecifications`. This points the old method at
 * the new one, minus the warning. Panel only, and only while Vitest still has
 * both methods. Remove once the extension calls `parseSpecifications`
 * (https://github.com/vitest-dev/vscode/issues/834).
 */
const parseSpecificationsShim = {
  name: 'ngrx:vscode-parse-specifications',
  configureVitest({ vitest }: { vitest: Vitest }) {
    // Typed locally: replacing the deprecated method is the point here, so
    // the editor's "is deprecated" hint on it would only be noise.
    const extensionApi = vitest as unknown as {
      experimental_parseSpecifications?: Vitest['parseSpecifications'];
    };
    if (
      typeof extensionApi.experimental_parseSpecifications === 'function' &&
      typeof vitest.parseSpecifications === 'function'
    ) {
      extensionApi.experimental_parseSpecifications =
        vitest.parseSpecifications.bind(vitest);
    }
  },
};

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
      ...(inTestingPanel ? [parseSpecificationsShim] : []),
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
      ...(inTestingPanel ? { maxWorkers: 3 } : {}),
      include: ['**/*.{spec,test}.ts'],
      passWithNoTests: true,
      setupFiles: ['test-setup.ts'],
      // A ceiling for hung tests, not a performance gate. The slow tests here
      // (spec/types/**, which start a TypeScript compiler per file) take ~12s on
      // a quiet machine but measured 2.5x+ slower in the VS Code Testing panel
      // (watch mode, VS Code's own runtime, all modules competing for memory),
      // where a 30s limit was still being hit.
      testTimeout: 60000,
      // The same ceiling for beforeEach/afterAll hooks, which otherwise keep
      // Vitest's 10s default: the schematics specs build a whole Angular
      // workspace in beforeEach, and under a full parallel run
      // (`nx run-many -t build,lint,test --all`) two of them took 12.8s and
      // 13.8s and failed, while the same suite passed on its own.
      hookTimeout: 60000,
      // How long a finished forks worker may take to exit before Vitest logs
      // "[vitest-pool]: Timeout terminating forks worker". Stopping a worker
      // waits for its output to flush into Vitest's own stdout, which lags
      // when a full run loads the machine: 30s was exceeded in both the panel
      // and the CLI, always after the tests had passed (each flagged file
      // stops within 1s when run alone). This only sets when the message is
      // logged; a worker that really hangs is still killed by Vitest.
      teardownTimeout: 120000,
      // Default (300ms) flags nearly every compile-time type-assertion test
      // (spec/types/**, invokes tsc/vue-tsc) and every schematics/migrations
      // test (SchematicTestRunner does real Tree/filesystem I/O) as "slow" -
      // that's inherent to how those tests work, not a regression. 2000ms
      // keeps the signal meaningful for genuine runtime perf issues instead.
      slowTestThreshold: 2000,
      typecheck: {
        enabled: !inTestingPanel,
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
            ['html', { outputDir: './test-results' }],
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
                // Deliberately not extending the shared config: plain Node tooling
                // needs none of the Angular plugins, the setup file or the type
                // tests, and an inherited array such as setupFiles cannot be
                // emptied again. Vitest 5 made inheriting the default for inline
                // projects, so opting out has to be explicit.
                extends: false,
                root: fileURLToPath(new URL('./scripts', import.meta.url)),
                test: { name: scriptsProject, environment: 'node' },
              },
            ]
          : []),
      ],
    },
  };
});
