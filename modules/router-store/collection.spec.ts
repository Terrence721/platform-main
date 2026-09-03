import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as RouterStoreOptions } from '../schematics/ng-add/router-store/schema';
import { createWorkspace } from '@ngrx/schematics-core/testing';

// Proves the real `ng add @ngrx/router-store` resolution path works - see
// modules/store/collection.spec.ts for the full rationale, identical here.
describe('Router Store package collection.json (real `ng add @ngrx/router-store` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/router-store',
    path.join(process.cwd(), 'dist/modules/router-store/collection.json')
  );
  const defaultOptions: RouterStoreOptions = {
    skipPackageJson: false,
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

    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
  });
});
