import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as StoreOptions } from './schema';
import {
  getTestProjectPath,
  createWorkspace,
  defaultWorkspaceOptions,
  defaultAppOptions,
} from '@ngrx/schematics-core/testing';

describe('Store Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/schematics',
    path.join(process.cwd(), 'dist/modules/schematics/collection.json')
  );
  const defaultOptions: StoreOptions = {
    name: 'foo',
    project: 'bar',
    module: undefined,
    flat: false,
    root: true,
  };

  const projectPath = getTestProjectPath();

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  it('should create the initial store setup', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should skip the initial store setup files if the minimal flag is provided', async () => {
    const options = {
      ...defaultOptions,
      module: 'app-module.ts',
      minimal: true,
    };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBe(-1);
  });

  it('should not skip the initial store setup files if the minimal flag is provided with a feature', async () => {
    const options = {
      ...defaultOptions,
      root: false,
      module: 'app-module.ts',
      minimal: true,
    };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should create the initial store to specified project if provided', async () => {
    const options = {
      ...defaultOptions,
      project: 'baz',
      // 'baz' is an Angular library fixture (see createWorkspace()), which
      // has no root NgModule at all - skipImport makes that explicit rather
      // than relying on auto-detect failing to find one to wire into.
      skipImport: true,
    };

    const specifiedProjectPath = getTestProjectPath(defaultWorkspaceOptions, {
      ...defaultAppOptions,
      name: 'baz',
    });

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const files = tree.files;

    expect(
      files.indexOf(`${specifiedProjectPath}/src/lib/reducers/index.ts`)
    ).toBeGreaterThanOrEqual(0);
  });

  it('should create the initial store to defaultProject if project is not provided', async () => {
    const options = {
      ...defaultOptions,
      project: undefined,
    };

    const specifiedProjectPath = getTestProjectPath(defaultWorkspaceOptions, {
      ...defaultAppOptions,
      name: 'bar',
    });

    const tree = await schematicRunner.runSchematic('store', options, appTree);

    const files = tree.files;

    expect(
      files.indexOf(`${specifiedProjectPath}/src/app/reducers/index.ts`)
    ).toBeGreaterThanOrEqual(0);
  });

  it('should import into a specified module', async () => {
    const options = { ...defaultOptions, module: 'app-module.ts' };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should fail if specified module does not exist', async () => {
    const options = { ...defaultOptions, module: 'app.moduleXXX.ts' };
    await expect(
      schematicRunner.runSchematic('store', options, appTree)
    ).rejects.toThrow(
      `Specified module path ${projectPath}/src/app/app.moduleXXX.ts does not exist`
    );
  });

  it('should import a feature a specified module', async () => {
    const options = { ...defaultOptions, root: false, module: 'app-module.ts' };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should support a default root state interface name', async () => {
    const options = { ...defaultOptions, name: 'State' };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should support a custom root state interface name', async () => {
    const options = {
      ...defaultOptions,
      name: 'State',
      stateInterface: 'AppState',
    };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should support a default feature state interface name', async () => {
    const options = { ...defaultOptions, root: false, name: 'Feature' };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should support a custom feature state interface name', async () => {
    const options = {
      ...defaultOptions,
      root: false,
      name: 'Feature',
      stateInterface: 'FeatureState',
    };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should fail if a feature state name is not specified', async () => {
    const options = {
      ...defaultOptions,
      name: undefined,
      root: false,
    };

    await expect(
      schematicRunner.runSchematic('store', options, appTree)
    ).rejects.toThrow('Please provide a name for the feature state');
  });

  it('should pass if a root state name is not specified', async () => {
    const options = {
      ...defaultOptions,
      name: undefined,
    };

    // Awaited: an async callback in expect(...).not.toThrow() returns a
    // promise and can never throw synchronously.
    const tree = await schematicRunner.runSchematic('store', options, appTree);

    expect(tree.files).toContain(`${projectPath}/src/app/reducers/index.ts`);
  });

  it('should add a feature key if not root', async () => {
    const options = { ...defaultOptions, root: false };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should not add a feature key if root', async () => {
    const options = { ...defaultOptions };

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const modulePath = `${projectPath}/src/app/app-module.ts`;
    const reducersPath = `${projectPath}/src/app/reducers/index.ts`;

    expect(tree.files.indexOf(modulePath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(modulePath)).toMatchSnapshot();

    expect(tree.files.indexOf(reducersPath)).toBeGreaterThanOrEqual(0);
    expect(tree.readContent(reducersPath)).toMatchSnapshot();
  });

  it('should add the initial config correctly into an empty module', async () => {
    const options = {
      ...defaultOptions,
      module: 'empty.module.ts',
    };

    appTree.create(
      `${projectPath}/src/app/empty.module.ts`,
      `
        import { NgModule } from '@angular/core';

        @NgModule({
          declarations: [],
          imports: [],
        })
        export class EmptyModule {}
      `
    );

    const tree = await schematicRunner.runSchematic('store', options, appTree);
    const content = tree.readContent(`${projectPath}/src/app/empty.module.ts`);

    expect(content).toMatchSnapshot();
  });

  describe('in a standalone app, which has no NgModule', () => {
    const standaloneProjectPath = getTestProjectPath(defaultWorkspaceOptions, {
      ...defaultAppOptions,
      name: 'bar-standalone',
    });

    it('should create the root state', async () => {
      const tree = await schematicRunner.runSchematic(
        'store',
        { ...defaultOptions, project: 'bar-standalone' },
        appTree
      );

      expect(tree.files).toContain(
        `${standaloneProjectPath}/src/app/reducers/index.ts`
      );
    });

    it('should create a feature state', async () => {
      const tree = await schematicRunner.runSchematic(
        'store',
        { ...defaultOptions, project: 'bar-standalone', root: false },
        appTree
      );

      expect(
        tree.readContent(`${standaloneProjectPath}/src/app/reducers/index.ts`)
      ).toContain("export const fooFeatureKey = 'foo';");
    });
  });

  it('should only import what the state file uses', async () => {
    const tree = await schematicRunner.runSchematic(
      'store',
      { ...defaultOptions, root: false },
      appTree
    );
    const content = tree.readContent(
      `${projectPath}/src/app/reducers/index.ts`
    );

    expect(content).toContain(
      "import { ActionReducerMap, MetaReducer } from '@ngrx/store';"
    );
    for (const unused of [
      'ActionReducer,',
      'createFeatureSelector',
      'createSelector',
    ]) {
      expect(content).not.toContain(unused);
    }
  });
});
