import { Linter } from 'eslint';
import * as path from 'path';
import { NGRX_MODULE_PATHS, traverseFolder } from '../src/utils';
import plugin, { configs, rules as exportedRules } from '../src';

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
  test('every rule links its documentation page', () => {
    for (const [ruleName, rule] of Object.entries(exportedRules)) {
      expect(rule.meta.docs?.url).toBe(
        `https://ngrx.io/guide/eslint-plugin/rules/${ruleName}`
      );
      expect(rule.meta.docs?.description).toBeTruthy();
    }
  });
  // The config generator takes a rule's module from its folder, so a rule
  // declaring another module would disagree with the config it lands in.
  test('every rule declares the NgRx module of its folder', () => {
    for (const { file, folder } of traverseFolder(rulesDirectory, ['.ts'])) {
      if (file === 'index') {
        continue;
      }
      const ngrxModule = path.basename(folder);
      expect(Object.keys(NGRX_MODULE_PATHS)).toContain(ngrxModule);
      expect({
        rule: file,
        ngrxModule:
          exportedRules[file as keyof typeof exportedRules].meta.docs
            ?.ngrxModule,
      }).toEqual({ rule: file, ngrxModule });
    }
  });
  test('exports all configurations', () => {
    const configFiles = getAllConfigs();
    expect(configFiles.length).toBe(10);
    expect(Object.keys(configs).length).toBe(10);
  });
  // Template rules need the optional template parser, so they are only in
  // the `component` config; `all` and `allTypeChecked` hold the rest.
  test('exports every rule except template rules in the all type-checked config', () => {
    const expected = Object.entries(exportedRules)
      .filter(([, rule]) => rule.meta.docs?.template !== true)
      .map(([ruleName]) => `@ngrx/${ruleName}`)
      .sort();
    expect(
      Object.keys((configs.allTypeChecked[1] as any).rules).sort()
    ).toEqual(expected);
  });
  test('exports every rule without type checking in the all config', () => {
    const expected = Object.entries(exportedRules)
      .filter(
        ([, rule]) =>
          rule.meta.docs?.requiresTypeChecking !== true &&
          rule.meta.docs?.template !== true
      )
      .map(([ruleName]) => `@ngrx/${ruleName}`)
      .sort();
    expect(Object.keys((configs.all[1] as any).rules).sort()).toEqual(expected);
  });
  test('the component config lints Angular templates', () => {
    const linter = new Linter({ configType: 'flat' });
    const messages = linter.verify(
      `<ng-container *ngrxLet="items$ | async as items">{{ items }}</ng-container>`,
      // typescript-eslint's config types differ from ESLint's own.
      configs.component as Linter.Config[],
      'file.html'
    );
    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(messages.map((message) => message.ruleId)).toEqual([
      '@ngrx/no-async-pipe-in-ngrx-let',
    ]);
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
    { config: 'component', ngrxModule: 'component', typeChecked: false },
    {
      config: 'componentStore',
      ngrxModule: 'component-store',
      typeChecked: false,
    },
    { config: 'effectsTypeChecked', ngrxModule: 'effects', typeChecked: true },
    { config: 'effects', ngrxModule: 'effects', typeChecked: false },
    { config: 'operators', ngrxModule: 'operators', typeChecked: false },
    { config: 'signalsTypeChecked', ngrxModule: 'signals', typeChecked: true },
    { config: 'signals', ngrxModule: 'signals', typeChecked: false },
    { config: 'store', ngrxModule: 'store', typeChecked: false },
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
  test('a config can register the default export next to a preset', () => {
    const linter = new Linter({ configType: 'flat' });
    const messages = linter.verify(
      `import { createAction } from '@ngrx/store';
      const x = createAction('x');`,
      // typescript-eslint's config types differ from ESLint's own.
      [
        ...configs.store,
        {
          files: ['**/*.ts'],
          plugins: { '@ngrx': plugin },
          rules: { '@ngrx/good-action-hygiene': 'warn' },
        },
      ] as Linter.Config[],
      'file.ts'
    );
    expect(
      messages.map(({ ruleId, severity }) => ({ ruleId, severity }))
    ).toEqual([{ ruleId: '@ngrx/good-action-hygiene', severity: 1 }]);
  });
  test('there is a difference between type-checked rules', () => {
    expect(
      Object.keys((configs.allTypeChecked[1] as any).rules).length
    ).toBeGreaterThan(Object.keys((configs.all[1] as any).rules).length);
  });
});
