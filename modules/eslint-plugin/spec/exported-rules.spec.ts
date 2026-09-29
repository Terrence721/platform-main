import { Linter } from 'eslint';
import * as path from 'path';
import { traverseFolder } from '../src/utils';
import { configs, rules as exportedRules } from '../src';

const rulesDirectory = path.join(__dirname, '../src/rules');
const configsDirectory = path.join(__dirname, '../src/configs');

function getAllRules() {
  return [...traverseFolder(rulesDirectory, ['.ts'])]
    .map((rule) => rule.file)
    .filter((rule) => rule !== 'index');
}
function getAllConfigs() {
  return [...traverseFolder(configsDirectory, ['.ts'])];
}

describe('ESLint flat config', () => {
  test('exports all rules', () => {
    const rules = getAllRules();
    expect(Object.keys(exportedRules).length).toBe(rules.length);
  });
  test('exports all configurations', () => {
    const configFiles = getAllConfigs();
    expect(configFiles.length).toBe(9);
    expect(Object.keys(configs).length).toBe(9);
  });
  test('exports all rules in the all type-checked config', () => {
    const rules = getAllRules();
    expect(Object.keys((configs.allTypeChecked[1] as any).rules).length).toBe(
      rules.length
    );
  });
  test('exports every rule without type checking in the all config', () => {
    const expected = Object.entries(exportedRules)
      .filter(([, rule]) => rule.meta.docs?.requiresTypeChecking !== true)
      .map(([ruleName]) => `@ngrx/${ruleName}`)
      .sort();
    expect(Object.keys((configs.all[1] as any).rules).sort()).toEqual(expected);
  });
  test('the all config runs without type information', () => {
    const linter = new Linter({ configType: 'flat' });
    const messages = linter.verify(
      `import { createAction } from '@ngrx/store';
      const x = createAction('x');`,
      // typescript-eslint's config types differ from ESLint's own.
      [...configs.all, { files: ['**/*.ts'] }] as Linter.Config[],
      'file.ts'
    );
    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(messages.map((message) => message.ruleId)).toEqual([
      '@ngrx/good-action-hygiene',
    ]);
  });
  test.each([
    {
      config: 'componentStore',
      ngrxModule: 'component-store',
      typeChecked: false,
    },
    { config: 'effectsTypeChecked', ngrxModule: 'effects', typeChecked: true },
  ] as const)(
    'exports the $ngrxModule rules in the $config config',
    ({ config, ngrxModule, typeChecked }) => {
      const expected = Object.entries(exportedRules)
        .filter(
          ([, rule]) =>
            rule.meta.docs?.ngrxModule === ngrxModule &&
            (typeChecked || rule.meta.docs?.requiresTypeChecking !== true)
        )
        .map(([ruleName]) => `@ngrx/${ruleName}`)
        .sort();
      expect(expected.length).toBeGreaterThan(0);
      expect(Object.keys((configs[config][1] as any).rules).sort()).toEqual(
        expected
      );
    }
  );
  test('there is a difference between type-checked rules', () => {
    expect(
      Object.keys((configs.allTypeChecked[1] as any).rules).length
    ).toBeGreaterThan(Object.keys((configs.all[1] as any).rules).length);
  });
});
