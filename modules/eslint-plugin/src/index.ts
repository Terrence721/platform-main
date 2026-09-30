import type { TSESLint } from '@typescript-eslint/utils';
import { parser } from 'typescript-eslint';
import { rules } from './rules';
import {
  name as packageName,
  version as packageVersion,
} from '../package.json';
import all from './configs/all';
import allTypeChecked from './configs/all-type-checked';
import component from './configs/component';
import store from './configs/store';
import effects from './configs/effects';
import effectsTypeChecked from './configs/effects-type-checked';
import componentStore from './configs/component-store';
import operators from './configs/operators';
import signals from './configs/signals';
import signalsTypeChecked from './configs/signals-type-checked';

const meta = { name: packageName, version: packageVersion };

const tsPlugin: TSESLint.FlatConfig.Plugin & {
  meta: typeof meta;
  rules: typeof rules;
} = {
  meta,
  rules,
};

// The template parser is an optional peer dependency, needed only by the
// `component` config: it is loaded the first time that config is read, so
// the other configs work without it installed.
let componentConfig: TSESLint.FlatConfig.ConfigArray | undefined;
function getComponentConfig(): TSESLint.FlatConfig.ConfigArray {
  if (!componentConfig) {
    let templateParser: TSESLint.FlatConfig.Parser;
    try {
      templateParser = require('@angular-eslint/template-parser');
    } catch {
      throw new Error(
        "@ngrx/eslint-plugin: the 'component' config lints Angular templates " +
          'and needs @angular-eslint/template-parser: install it as a dev ' +
          'dependency.'
      );
    }
    componentConfig = component(tsPlugin, templateParser);
  }
  return componentConfig;
}

const configs = {
  all: all(tsPlugin, parser),
  allTypeChecked: allTypeChecked(tsPlugin, parser),
  get component() {
    return getComponentConfig();
  },
  store: store(tsPlugin, parser),
  effects: effects(tsPlugin, parser),
  effectsTypeChecked: effectsTypeChecked(tsPlugin, parser),
  componentStore: componentStore(tsPlugin, parser),
  operators: operators(tsPlugin, parser),
  signals: signals(tsPlugin, parser),
  signalsTypeChecked: signalsTypeChecked(tsPlugin, parser),
};

// The default export is the same object the configs register under '@ngrx':
// ESLint rejects two different objects under one plugin name, so a config
// that also registers the default export (to change a rule) must get this one.
export default Object.assign(tsPlugin, { configs });
export { configs, meta, rules };
