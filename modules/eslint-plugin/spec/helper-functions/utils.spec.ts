import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { Linter } from 'eslint';
import { parser } from 'typescript-eslint';
import {
  getImportAddFix,
  getImportDeclarations,
  getImportRemoveFix,
  getNgRxStores,
  getRawText,
  isVariableOfClass,
} from '../../src/utils';

type Context = TSESLint.RuleContext<'probe', []>;

// Runs `create` as a rule on `code`; its reports (with a fix) are applied.
function lint(
  code: string,
  create: (context: Context) => TSESLint.RuleListener
): { messages: string[]; output: string } {
  const rule = {
    meta: {
      type: 'problem',
      fixable: 'code',
      messages: { probe: '{{ text }}' },
      schema: [],
    },
    create,
  };
  const config = [
    {
      files: ['**/*.ts'],
      languageOptions: { parser },
      plugins: { test: { rules: { probe: rule } } },
      rules: { 'test/probe': 'error' },
    },
  ] as unknown as Linter.Config[];
  const linter = new Linter({ configType: 'flat' });
  const messages = linter
    .verify(code, config, 'file.ts')
    .map(({ message }) => message);
  const { output } = linter.verifyAndFix(code, config, 'file.ts');
  return { messages, output };
}

describe('getNgRxStores', () => {
  it('finds stores when Store is imported under another name', () => {
    const { messages } = lint(
      `import { Store as AppStore } from '@ngrx/store';
class A { constructor(private store: AppStore) {} }`,
      (context) => ({
        Program() {
          const { identifiers = [] } = getNgRxStores(context);
          for (const { name } of identifiers) {
            context.report({
              loc: { line: 1, column: 0 },
              messageId: 'probe',
              data: { text: name },
            });
          }
        },
      })
    );

    expect(messages).toEqual(['store']);
  });
});

describe('isVariableOfClass', () => {
  it.each([
    ['a variable set to inject', 'const s = inject(AppStore); s;', true],
    ['a parameter default', 'function f(s = inject(AppStore)) { s; }', true],
    ['a typed parameter', 'function f(s: AppStore) { s; }', true],
    ['another class', 'const s = inject(Other); s;', false],
    ['another initializer', 'const s = create(AppStore); s;', false],
  ])('%s is %s', (_, code, expected) => {
    const { messages } = lint(code, (context) => ({
      'ExpressionStatement > Identifier'(node: TSESTree.Identifier) {
        context.report({
          node,
          messageId: 'probe',
          data: {
            text: String(
              isVariableOfClass(context.sourceCode, node, 'AppStore')
            ),
          },
        });
      },
    }));

    expect(messages).toEqual([String(expected)]);
  });
});

describe('getImportAddFix', () => {
  it('puts a new import on its own line', () => {
    const { output } = lint(`class A {}`, (context) => ({
      ClassDeclaration(node) {
        context.report({
          node,
          messageId: 'probe',
          data: { text: '' },
          fix: (fixer) =>
            getImportAddFix({
              fixer,
              importName: 'select',
              moduleName: '@ngrx/store',
              node,
            }),
        });
      },
    }));

    expect(output).toBe(`import { select } from '@ngrx/store';\nclass A {}`);
  });
});

describe('getImportRemoveFix', () => {
  const removeSelect = (code: string) =>
    lint(code, (context) => ({
      Program(node) {
        context.report({
          node,
          messageId: 'probe',
          data: { text: '' },
          fix: (fixer) =>
            getImportRemoveFix(
              context.sourceCode,
              getImportDeclarations(node, '@ngrx/store') ?? [],
              'select',
              fixer
            ),
        });
      },
    })).output;

  it.each([
    [`import { select } from '@ngrx/store';`, ``],
    [
      `import { select, Store } from '@ngrx/store';`,
      `import {  Store } from '@ngrx/store';`,
    ],
    [
      `import { Store, select } from '@ngrx/store';`,
      `import { Store } from '@ngrx/store';`,
    ],
    [
      `import {\n  Store,\n  select,\n} from '@ngrx/store';`,
      `import {\n  Store,\n} from '@ngrx/store';`,
    ],
    [
      `import ngrx, { select } from '@ngrx/store';`,
      `import ngrx from '@ngrx/store';`,
    ],
    [
      `import ngrx, { select, Store } from '@ngrx/store';`,
      `import ngrx, {  Store } from '@ngrx/store';`,
    ],
  ])('%j becomes %j', (code, expected) => {
    expect(removeSelect(code)).toBe(expected);
  });
});

describe('getRawText', () => {
  const rawKey = (code: string) =>
    lint(code, (context) => ({
      Property(node) {
        context.report({
          node,
          messageId: 'probe',
          data: { text: String(getRawText(node.key)) },
        });
      },
    })).messages;

  it('reads a template literal without expressions', () => {
    expect(rawKey('({ [`fooReducer`]: 1 })')).toEqual(['`fooReducer`']);
  });

  it('has no text for a template literal with expressions', () => {
    expect(rawKey('({ [`fooReducer${x}`]: 1 })')).toEqual(['null']);
  });
});
