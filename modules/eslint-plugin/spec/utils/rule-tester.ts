import { RuleTester, type RunTests } from '@typescript-eslint/rule-tester';
import type { RuleModule } from '@typescript-eslint/utils/ts-eslint';
import * as templateParser from '@angular-eslint/template-parser';
import { resolve } from 'path';

/**
 * A RuleTester that names every test case without a `name`. RuleTester uses
 * the case's whole source code as the test title otherwise, so Vitest's
 * default reporter printed entire code snippets for the slow (type-aware)
 * cases. The name is the case's kind and number plus its first code line.
 */
class NamedRuleTester extends RuleTester {
  override run<MessageIds extends string, Options extends readonly unknown[]>(
    ruleName: string,
    rule: RuleModule<MessageIds, Options>,
    tests: RunTests<MessageIds, Options>
  ): void {
    super.run(ruleName, rule, {
      ...tests,
      valid: tests.valid.map((testCase, i) =>
        withName(
          typeof testCase === 'string' ? { code: testCase } : testCase,
          'valid',
          i
        )
      ),
      invalid: tests.invalid.map((testCase, i) =>
        withName(testCase, 'invalid', i)
      ),
    });
  }
}

function withName<T extends { readonly code: string; readonly name?: string }>(
  testCase: T,
  kind: 'valid' | 'invalid',
  index: number
): T {
  if (testCase.name) {
    return testCase;
  }
  return {
    ...testCase,
    name: `${kind} #${index + 1}: ${firstLine(testCase.code)}`,
  };
}

/** The first line that is not blank or an import, cut to 60 characters. */
function firstLine(code: string): string {
  const line =
    code
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('import ')) ?? '';
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
}

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
  return new NamedRuleTester({
    languageOptions,
  });
}

/** Creates the RuleTester for a template rule's spec: Angular templates. */
export function templateRuleTester() {
  return new NamedRuleTester({
    languageOptions: { parser: templateParser },
  });
}
