import type { ESLint, Linter } from 'eslint';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an eslint.config.ts imports it, so a missing or
// mistyped public export fails here (#162), not through a relative path.
// eslint-disable-next-line @nx/enforce-module-boundaries
import ngrx, { configs, meta, rules } from '@ngrx/eslint-plugin';

type ConfigName =
  | 'all'
  | 'allTypeChecked'
  | 'component'
  | 'store'
  | 'effects'
  | 'effectsTypeChecked'
  | 'componentStore'
  | 'operators'
  | 'signals'
  | 'signalsTypeChecked';

type RuleName =
  // component (templates)
  | 'no-async-pipe-in-ngrx-let'
  | 'no-async-with-ngrx-push'
  | 'prefer-ngrx-push'
  // component-store
  | 'avoid-combining-component-store-selectors'
  | 'avoid-mapping-component-store-selectors'
  | 'updater-explicit-return-type'
  | 'require-super-ondestroy'
  // effects
  | 'avoid-cyclic-effects'
  | 'no-dispatch-in-effects'
  | 'no-effects-in-providers'
  | 'no-multiple-actions-in-effects'
  | 'prefer-action-creator-in-of-type'
  | 'prefer-effect-callback-in-block-statement'
  | 'use-effects-lifecycle-interface'
  // store
  | 'avoid-combining-selectors'
  | 'avoid-dispatching-multiple-actions-sequentially'
  | 'avoid-duplicate-actions-in-reducer'
  | 'avoid-mapping-selectors'
  | 'good-action-hygiene'
  | 'no-multiple-global-stores'
  | 'no-reducer-in-key-names'
  | 'no-store-subscription'
  | 'no-typed-global-store'
  | 'on-function-explicit-return-type'
  | 'prefer-action-creator'
  | 'prefer-action-creator-in-dispatch'
  | 'prefer-inline-action-props'
  | 'prefer-one-generic-in-create-for-feature-selector'
  | 'prefer-selector-in-select'
  | 'prefix-selectors-with-select'
  | 'select-style'
  | 'use-consistent-global-store-name'
  // operators
  | 'prefer-concat-latest-from'
  // signals
  | 'signal-state-no-arrays-at-root-level'
  | 'signal-store-feature-should-use-generic-type'
  | 'prefer-protected-state'
  | 'with-state-no-arrays-at-root-level'
  | 'enforce-type-call';

describe('@ngrx/eslint-plugin public types', () => {
  it('exports every config, and only those', () => {
    expectTypeOf<keyof typeof configs>().toEqualTypeOf<ConfigName>();
    expectTypeOf(ngrx.configs).toEqualTypeOf(configs);
  });

  it('exports every rule, and only those', () => {
    expectTypeOf<keyof typeof rules>().toEqualTypeOf<RuleName>();
  });

  it('types each rule with its options', () => {
    // `defaultOptions` is optional on typescript-eslint's RuleModule.
    type Options = {
      [Name in keyof typeof rules]: NonNullable<
        (typeof rules)[Name]['defaultOptions']
      >;
    };
    expectTypeOf<Options>().toEqualTypeOf<{
      [Name in RuleName]: Name extends 'prefer-concat-latest-from'
        ? readonly [{ readonly strict: boolean }]
        : Name extends 'select-style'
          ? readonly ['method' | 'operator']
          : Name extends 'use-consistent-global-store-name'
            ? readonly [string]
            : readonly [];
    }>();
  });

  it('exports the package name and version as meta', () => {
    expectTypeOf(meta).toEqualTypeOf<{ name: string; version: string }>();
    expectTypeOf(ngrx.meta).toEqualTypeOf(meta);
  });

  it('types the default export as a plugin with meta and configs', () => {
    expectTypeOf<keyof typeof ngrx>().toEqualTypeOf<'meta' | 'configs'>();
  });

  describe('works with ESLint’s own config types', () => {
    it('every config is a Linter.Config array', () => {
      expectTypeOf<(typeof configs)[ConfigName]>().toExtend<Linter.Config[]>();
    });

    it('the default export is an ESLint.Plugin', () => {
      expectTypeOf(ngrx).toExtend<ESLint.Plugin>();
    });

    it('defineConfig takes a config and the plugin registered next to it', () => {
      expectTypeOf(defineConfig).toBeCallableWith(
        configs.all,
        ngrx.configs.component,
        {
          files: ['**/*.ts'],
          plugins: { '@ngrx': ngrx },
          rules: { '@ngrx/select-style': ['warn', 'operator'] },
        }
      );
    });

    it('typescript-eslint’s config helper takes them too', () => {
      expectTypeOf(tseslint.config).toBeCallableWith(...configs.all, {
        plugins: { '@ngrx': ngrx },
      });
    });
  });
});
