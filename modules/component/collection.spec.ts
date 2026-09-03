import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as SchemaOptions } from '../schematics/ng-add/component/schema';
import { createWorkspace } from '@ngrx/schematics-core/testing';

// Proves the real `ng add @ngrx/component` resolution path works - see
// modules/store/collection.spec.ts for the full rationale, identical here.
describe('Component package collection.json (real `ng add @ngrx/component` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/component',
    path.join(process.cwd(), 'dist/modules/component/collection.json')
  );
  const defaultOptions: SchemaOptions = {
    skipPackageJson: false,
  };

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  it('resolves the literal "ng-add" schematic name and updates package.json', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner.runSchematic('ng-add', options, appTree);
    const packageJson = JSON.parse(tree.readContent('/package.json'));

    expect(packageJson.dependencies['@ngrx/component']).toBeDefined();
  });
});
