import { defineProject, mergeConfig } from 'vitest/config';
import { baseConfig } from '../../vitest.config.mts';

export default defineProject((config) =>
  mergeConfig(baseConfig, {
    root: __dirname,
    test: {
      name: 'effects',
      include: ['spec/**/*.spec.ts'],
      // provide_effects.spec.ts imports concatLatestFrom from @ngrx/operators,
      // which isn't ported yet (next module after effects in todo.md's
      // sequencing) - re-include (both here and in typecheck.exclude below)
      // once modules/operators exists.
      exclude: ['spec/provide_effects.spec.ts'],
      typecheck: {
        exclude: ['spec/provide_effects.spec.ts'],
      },
    },
    define: {
      'import.meta.vitest': config.mode !== 'production',
    },
  })
);
