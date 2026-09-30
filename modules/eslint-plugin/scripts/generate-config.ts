import { writeFileSync } from 'fs';
import { join } from 'path';
import { format, resolveConfig } from 'prettier';
import { rulesForGenerate } from '../src/utils/helper-functions/rules';
import { NgRxRule } from '../src/rule-creator';

(async () => {
  const prettierConfig = await resolveConfig(__dirname);
  const RULE_MODULE = '@ngrx';
  const CONFIG_DIRECTORY = './modules/eslint-plugin/src/configs/';

  const isModule = (rule: NgRxRule, moduleName: string) =>
    rule.meta.docs?.ngrxModule === moduleName;
  const isTypeChecked = (rule: NgRxRule) =>
    rule.meta.docs?.requiresTypeChecking === true;
  // Template rules need @angular-eslint/template-parser, an optional peer:
  // they live in the `component` config only, so `all` works without it.
  const isTemplate = (rule: NgRxRule) => rule.meta.docs?.template === true;

  writeConfig('all', (rule) => !isTypeChecked(rule) && !isTemplate(rule));
  writeConfig('all-type-checked', (rule) => !isTemplate(rule));

  writeConfig(
    'component',
    (rule) => isModule(rule, 'component') && !isTypeChecked(rule),
    { template: true }
  );

  writeConfig(
    'store',
    (rule) => isModule(rule, 'store') && !isTypeChecked(rule)
  );

  writeConfig(
    'effects',
    (rule) => isModule(rule, 'effects') && !isTypeChecked(rule)
  );
  writeConfig('effects-type-checked', (rule) => isModule(rule, 'effects'));

  writeConfig(
    'component-store',
    (rule) => isModule(rule, 'component-store') && !isTypeChecked(rule)
  );

  writeConfig(
    'operators',
    (rule) => isModule(rule, 'operators') && !isTypeChecked(rule)
  );

  writeConfig(
    'signals',
    (rule) => isModule(rule, 'signals') && !isTypeChecked(rule)
  );
  writeConfig('signals-type-checked', (rule) => isModule(rule, 'signals'));

  async function writeConfig(
    configName:
      | 'all'
      | 'all-type-checked'
      | 'component'
      | 'store'
      | 'effects'
      | 'effects-type-checked'
      | 'component-store'
      | 'operators'
      | 'signals'
      | 'signals-type-checked',
    predicate: (rule: NgRxRule) => boolean,
    { template = false }: { template?: boolean } = {}
  ) {
    // Opt-in rules are in no config: users enable them by name.
    const rulesForConfig = Object.entries(rulesForGenerate).filter(
      ([_, rule]) => predicate(rule) && rule.meta.docs?.optIn !== true
    );
    const configRules = rulesForConfig.reduce<Record<string, string>>(
      (rules, [ruleName, _rule]) => {
        rules[`${RULE_MODULE}/${ruleName}`] = 'error';
        return rules;
      },
      {}
    );

    // Type-checked configs include rules that need type information; say so
    // where users read the config, since ESLint fails without it.
    const typeInfoNote = configName.endsWith('-type-checked')
      ? `
     *
     * Includes rules that need type information: add parserOptions for it,
     * or ESLint fails with "You have used a rule which requires type
     * information". For example:
     *   {
     *     languageOptions: {
     *       parserOptions: {
     *         projectService: true,
     *         tsconfigRootDir: import.meta.dirname,
     *       },
     *     },
     *   }`
      : '';
    // A template config parses only HTML templates, with the template parser;
    // it must not set a parser for every file the way the others do.
    const templateNote = template
      ? `
     *
     * Lints Angular templates (the .html files) and needs
     * \`@angular-eslint/template-parser\` installed. For inline templates, also
     * run angular-eslint's \`processInlineTemplates\` processor on .ts files.`
      : '';
    const base = template
      ? `{
          name: 'ngrx/base',
          plugins: {
            '@ngrx': plugin,
          },
        }`
      : `{
          name: 'ngrx/base',
          languageOptions: {
            parser,
          },
          plugins: {
            '@ngrx': plugin,
          },
        }`;
    const files = template ? `files: ['**/*.html'], ` : '';
    const tsCode = `
      /**
     * DO NOT EDIT
     * This file is generated${typeInfoNote}${templateNote}
     */

      import type { TSESLint } from '@typescript-eslint/utils';

      export default (
        plugin: TSESLint.FlatConfig.Plugin,
        parser: TSESLint.FlatConfig.Parser,
      ): TSESLint.FlatConfig.ConfigArray => [
        ${base},
        {
          name: 'ngrx/${configName}',
          ${files}languageOptions: {
            parser,
          },
          rules: ${JSON.stringify(configRules, null, 2)}
        },
      ];`;
    const tsConfigFormatted = await format(tsCode, {
      parser: 'typescript',
      ...prettierConfig,
    });
    writeFileSync(
      join(CONFIG_DIRECTORY, `${configName}.ts`),
      tsConfigFormatted
    );
  }
})();
