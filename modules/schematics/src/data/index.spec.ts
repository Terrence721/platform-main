import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as DataOptions } from './schema';
import {
  getTestProjectPath,
  createWorkspace,
  defaultWorkspaceOptions,
  defaultAppOptions,
} from '@ngrx/schematics-core/testing';

describe('Data Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/schematics',
    path.join(process.cwd(), 'dist/modules/schematics/collection.json')
  );
  const defaultOptions: DataOptions = {
    name: 'foo',
    project: 'bar',
    group: false,
    flat: true,
  };

  const projectPath = getTestProjectPath();

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  it('should create the data service to a specified project if provided', async () => {
    const options = { ...defaultOptions, project: 'baz' };

    const specifiedProjectPath = getTestProjectPath(defaultWorkspaceOptions, {
      ...defaultAppOptions,
      name: 'baz',
    });

    const tree = await schematicRunner.runSchematic('data', options, appTree);
    const files = tree.files;
    expect(
      files.indexOf(`${specifiedProjectPath}/src/lib/foo.service.ts`)
    ).toBeGreaterThanOrEqual(0);
    expect(
      files.indexOf(`${specifiedProjectPath}/src/lib/foo.ts`)
    ).toBeGreaterThanOrEqual(0);
  });

  it('should create the service and model files', async () => {
    const tree = await schematicRunner.runSchematic(
      'data',
      defaultOptions,
      appTree
    );
    expect(
      tree.files.indexOf(`${projectPath}/src/app/foo.service.ts`)
    ).toBeGreaterThanOrEqual(0);
    expect(
      tree.files.indexOf(`${projectPath}/src/app/foo.ts`)
    ).toBeGreaterThanOrEqual(0);
  });

  it('should create two files if skipTests is false(as it is by default)', async () => {
    const options = {
      ...defaultOptions,
    };
    const tree = await schematicRunner.runSchematic('data', options, appTree);
    expect(
      tree.files.indexOf(`${projectPath}/src/app/foo.service.spec.ts`)
    ).toBeGreaterThanOrEqual(0);
    expect(
      tree.files.indexOf(`${projectPath}/src/app/foo.service.ts`)
    ).toBeGreaterThanOrEqual(0);
  });

  it('should create a service class', async () => {
    const options = { ...defaultOptions };
    const tree = await schematicRunner.runSchematic('data', options, appTree);
    const fileContent = tree.readContent(
      `${projectPath}/src/app/foo.service.ts`
    );

    expect(fileContent).toMatchSnapshot();
  });

  it('should create a model interface', async () => {
    const options = { ...defaultOptions };
    const tree = await schematicRunner.runSchematic('data', options, appTree);
    const fileContent = tree.readContent(`${projectPath}/src/app/foo.ts`);

    expect(fileContent).toMatchSnapshot();
  });

  it('should create a spec class', async () => {
    const options = { ...defaultOptions };
    const tree = await schematicRunner.runSchematic('data', options, appTree);
    const fileContent = tree.readContent(
      `${projectPath}/src/app/foo.service.spec.ts`
    );

    expect(fileContent).toMatchSnapshot();
  });

  it('should provide what the service needs in the spec', async () => {
    // The service's factory depends on the rest of @ngrx/data and on the
    // store, and the entity needs a definition, or `TestBed.inject` fails.
    const tree = await schematicRunner.runSchematic(
      'data',
      defaultOptions,
      appTree
    );
    const fileContent = tree.readContent(
      `${projectPath}/src/app/foo.service.spec.ts`
    );

    expect(fileContent).toContain('provideStore(),');
    expect(fileContent).toContain(
      'provideEntityData({ entityMetadata: { Foo: {} } }),'
    );
    expect(fileContent).not.toContain('EntityCollectionServiceElementsFactory');
  });

  it('should not create a spec file if skipTests is true', async () => {
    const tree = await schematicRunner.runSchematic(
      'data',
      { ...defaultOptions, skipTests: true },
      appTree
    );

    expect(tree.files).toContain(`${projectPath}/src/app/foo.service.ts`);
    expect(tree.files).not.toContain(
      `${projectPath}/src/app/foo.service.spec.ts`
    );
  });

  it('should create the files in a folder within the "data" folder if flat is false and group is set', async () => {
    const tree = await schematicRunner.runSchematic(
      'data',
      { ...defaultOptions, flat: false, group: true },
      appTree
    );

    expect(tree.files).toEqual(
      expect.arrayContaining([
        `${projectPath}/src/app/data/foo/foo.service.ts`,
        `${projectPath}/src/app/data/foo/foo.service.spec.ts`,
        `${projectPath}/src/app/data/foo/foo.ts`,
      ])
    );
  });

  it('should fail with a validation error if the name is missing', async () => {
    await expect(
      schematicRunner.runSchematic('data', { project: 'bar' }, appTree)
    ).rejects.toThrow("must have required property 'name'");
  });
});
