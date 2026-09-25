import { RuleTester } from '@typescript-eslint/rule-tester';
import { resolve } from 'path';

/**
 * Creates the RuleTester for a rule spec. Call `.run(...)` inside a static
 * `describe(...)`: RuleTester registers its tests dynamically, and Vitest's
 * typecheck mode finds tests by scanning the source for `describe` / `it`
 * calls, so a spec with none is reported as "No test suite found" (Vitest 5).
 */
export function ruleTester(requiresTypeChecking?: boolean) {
  const languageOptions =
    (requiresTypeChecking ?? false)
      ? {
          parserOptions: {
            tsconfigRootDir: resolve('./modules/eslint-plugin/spec/fixtures'),
            project: './tsconfig.json',
          },
        }
      : undefined;
  return new RuleTester({
    languageOptions,
  });
}
