import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as RootEffectOptions } from '../schematics/ng-add/effects/schema';
import { createWorkspace } from '@ngrx/schematics-core/testing';

// Proves the real `ng add @ngrx/effects` resolution path works - see
// modules/store/collection.spec.ts for the full rationale, identical here.
describe('Effects package collection.json (real `ng add @ngrx/effects` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/effects',
    path.join(process.cwd(), 'dist/modules/effects/collection.json')
  );
  const defaultOptions: RootEffectOptions = {
    name: 'foo',
    skipPackageJson: false,
    project: 'bar',
    module: 'app-module',
    flat: false,
    group: false,
    minimal: false,
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

    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
  });
});
