import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as EntityOptions } from '../schematics/ng-add/entity/schema';
import { createWorkspace } from '@ngrx/schematics-core/testing';

// Proves the real `ng add @ngrx/entity` resolution path works - see
// modules/store/collection.spec.ts for the full rationale, identical here.
describe('Entity package collection.json (real `ng add @ngrx/entity` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/entity',
    path.join(process.cwd(), 'dist/modules/entity/collection.json')
  );
  const defaultOptions: EntityOptions = {
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

    expect(packageJson.dependencies['@ngrx/entity']).toBeDefined();
  });
});
