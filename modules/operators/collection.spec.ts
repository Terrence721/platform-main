import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as SchemaOptions } from '../schematics/ng-add/operators/schema';
import { createWorkspace } from '@ngrx/schematics-core/testing';

// Proves the real `ng add @ngrx/operators` resolution path works - see
// modules/store/collection.spec.ts for the full rationale, identical here.
describe('Operators package collection.json (real `ng add @ngrx/operators` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/operators',
    path.join(process.cwd(), 'dist/modules/operators/collection.json')
  );
  const defaultOptions: SchemaOptions = {
    skipPackageJson: false,
  };

  let baseTree: UnitTestTree;
  let appTree: UnitTestTree;

  beforeAll(async () => {
    baseTree = await createWorkspace(schematicRunner, appTree);
  });

  beforeEach(() => {
    appTree = new UnitTestTree(baseTree.branch());
  });

  it('resolves the literal "ng-add" schematic name and updates package.json', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner.runSchematic('ng-add', options, appTree);
    const packageJson = JSON.parse(tree.readContent('/package.json'));

    expect(packageJson.dependencies['@ngrx/operators']).toBeDefined();
  });
});
