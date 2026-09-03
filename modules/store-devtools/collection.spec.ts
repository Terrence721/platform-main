import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as StoreDevtoolsOptions } from '../schematics/ng-add/store-devtools/schema';
import { createWorkspace } from '@ngrx/schematics-core/testing';

// Proves the real `ng add @ngrx/store-devtools` resolution path works - see
// modules/store/collection.spec.ts for the full rationale, identical here.
describe('Store-Devtools package collection.json (real `ng add @ngrx/store-devtools` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/store-devtools',
    path.join(process.cwd(), 'dist/modules/store-devtools/collection.json')
  );
  const defaultOptions: StoreDevtoolsOptions = {
    skipPackageJson: false,
    project: 'bar',
    module: 'app-module',
  };

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  it('resolves the literal "ng-add" schematic name and updates package.json', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner.runSchematic('ng-add', options, appTree);
    const packageJson = JSON.parse(tree.readContent('/package.json'));

    expect(packageJson.dependencies['@ngrx/store-devtools']).toBeDefined();
  });
});
