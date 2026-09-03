import { HostTree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';

// Proves the real `ng add @ngrx/eslint-plugin` resolution path works - see
// modules/store/collection.spec.ts for the full rationale, identical here.
describe('Eslint-plugin package collection.json (real `ng add @ngrx/eslint-plugin` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/eslint-plugin',
    path.join(process.cwd(), 'dist/modules/eslint-plugin/collection.json')
  );

  it('resolves the literal "ng-add" schematic name and registers the plugin', async () => {
    const host = new UnitTestTree(new HostTree());
    host.create(
      'eslint.config.js',
      `
// @ts-check
const tseslint = require('typescript-eslint');
module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
    ]
  }
);`
    );

    const tree = await schematicRunner.runSchematic(
      'ng-add',
      { config: 'store' },
      host
    );

    expect(tree.readText('eslint.config.js')).toContain('@ngrx/eslint-plugin');
  });
});
