import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as RootStoreOptions } from '../schematics/ng-add/store/schema';
import {
  getTestProjectPath,
  createWorkspace,
} from '@ngrx/schematics-core/testing';

// Proves the real `ng add @ngrx/store` resolution path works, not just the
// shared implementation it delegates to. Angular CLI resolves `ng add
// <package>` via *that package's own* `package.json` -> its own `schematics`
// collection -> a schematic literally named `ng-add`. Every existing ng-add
// spec (e.g. modules/schematics/ng-add/store/index.spec.ts) points
// SchematicTestRunner directly at the shared dist/modules/schematics/
// collection.json and invokes 'store-ng-add' - that exercises the shared
// factory but never proves modules/store's own collection.json + its
// relative '../schematics/ng-add/store' factory reference actually resolves.
describe('Store package collection.json (real `ng add @ngrx/store` path)', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/store',
    path.join(process.cwd(), 'dist/modules/store/collection.json')
  );
  const defaultOptions: RootStoreOptions = {
    skipPackageJson: false,
    skipESLintPlugin: false,
    project: 'bar',
    module: 'app-module',
    minimal: false,
  };

  const projectPath = getTestProjectPath();
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

    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
  });

  it('produces the same initial store setup as the shared store-ng-add schematic', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner.runSchematic('ng-add', options, appTree);
    const files = tree.files;

    expect(
      files.indexOf(`${projectPath}/src/app/reducers/index.ts`)
    ).toBeGreaterThanOrEqual(0);
  });
});
