import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as ActionOptions } from './schema';
import {
  getTestProjectPath,
  createWorkspace,
  defaultWorkspaceOptions,
  defaultAppOptions,
} from '@ngrx/schematics-core/testing';

describe('Action Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/schematics',
    path.join(process.cwd(), 'dist/modules/schematics/collection.json')
  );
  const defaultOptions: ActionOptions = {
    name: 'foo',
    prefix: 'load',
    project: 'bar',
    group: false,
    flat: true,
  };

  const projectPath = getTestProjectPath();

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  it('should create an action to specified project if provided', async () => {
    const options = {
      ...defaultOptions,
      project: 'baz',
    };

    const specifiedProjectPath = getTestProjectPath(defaultWorkspaceOptions, {
      ...defaultAppOptions,
      name: 'baz',
    });

    const tree = await schematicRunner.runSchematic('action', options, appTree);
    const files = tree.files;
    expect(
      files.includes(`${specifiedProjectPath}/src/lib/foo.actions.ts`)
    ).toBeTruthy();
  });

  it('should create one file', async () => {
    const tree = await schematicRunner.runSchematic(
      'action',
      defaultOptions,
      appTree
    );
    expect(
      tree.files.includes(`${projectPath}/src/app/foo.actions.ts`)
    ).toBeTruthy();
  });

  it('should not create test files', async () => {
    const options = {
      ...defaultOptions,
    };
    const tree = await schematicRunner.runSchematic('action', options, appTree);
    expect(
      tree.files.includes(`${projectPath}/src/app/foo.actions.spec.ts`)
    ).toBe(false);
  });

  describe('generated file', () => {
    const generate = async (options: ActionOptions) => {
      const tree = await schematicRunner.runSchematic(
        'action',
        options,
        appTree
      );

      return tree
        .readContent(`${projectPath}/src/app/foo.actions.ts`)
        .replace(/\r\n/g, '\n');
    };

    it('should only import what it uses when the api flag is not set', async () => {
      const fileContent = await generate(defaultOptions);

      expect(fileContent).toContain(
        "import { createActionGroup, emptyProps } from '@ngrx/store';"
      );
      expect(fileContent).not.toContain('props<');
    });

    it('should import props when the api flag is set', async () => {
      const fileContent = await generate({ ...defaultOptions, api: true });

      expect(fileContent).toContain(
        "import { createActionGroup, emptyProps, props } from '@ngrx/store';"
      );
    });

    it.each([false, true])(
      'should not leave lines with only whitespace (api: %s)',
      async (api) => {
        const fileContent = await generate({ ...defaultOptions, api });

        expect(fileContent).not.toMatch(/^[ \t]+$/m);
      }
    );
  });

  describe('location', () => {
    it('should create a folder named after the action if flat is false', async () => {
      const tree = await schematicRunner.runSchematic(
        'action',
        { ...defaultOptions, flat: false },
        appTree
      );

      expect(tree.files.filter((file) => file.endsWith('.actions.ts'))).toEqual(
        [`${projectPath}/src/app/foo/foo.actions.ts`]
      );
    });

    it('should create that folder within the "actions" folder if group is set as well', async () => {
      const tree = await schematicRunner.runSchematic(
        'action',
        { ...defaultOptions, flat: false, group: true },
        appTree
      );

      expect(tree.files.filter((file) => file.endsWith('.actions.ts'))).toEqual(
        [`${projectPath}/src/app/actions/foo/foo.actions.ts`]
      );
    });

    it('should create the file within the folders of a nested name', async () => {
      const tree = await schematicRunner.runSchematic(
        'action',
        { ...defaultOptions, name: 'bar/foo' },
        appTree
      );

      expect(tree.files.filter((file) => file.endsWith('.actions.ts'))).toEqual(
        [`${projectPath}/src/app/bar/foo.actions.ts`]
      );
      expect(
        tree.readContent(`${projectPath}/src/app/bar/foo.actions.ts`)
      ).toContain('export const FooActions = createActionGroup({');
    });
  });

  it('should fail with a validation error if the name is missing', async () => {
    await expect(
      schematicRunner.runSchematic('action', { project: 'bar' }, appTree)
    ).rejects.toThrow("must have required property 'name'");
  });

  it('should define actions using createActionGroup', async () => {
    const options = {
      ...defaultOptions,
    };

    const tree = await schematicRunner.runSchematic('action', options, appTree);
    const fileContent = tree.readContent(
      `${projectPath}/src/app/foo.actions.ts`
    );

    expect(fileContent).toMatchSnapshot();
  });

  it('should create api actions (load, success, error) when the api flag is set', async () => {
    const options = {
      ...defaultOptions,
      api: true,
    };

    const tree = await schematicRunner.runSchematic('action', options, appTree);
    const fileContent = tree.readContent(
      `${projectPath}/src/app/foo.actions.ts`
    );

    expect(fileContent).toMatchSnapshot();
  });

  it('should create an action with the defined prefix', async () => {
    const options = {
      ...defaultOptions,
      prefix: 'prefix',
    };

    const tree = await schematicRunner.runSchematic('action', options, appTree);
    const fileContent = tree.readContent(
      `${projectPath}/src/app/foo.actions.ts`
    );
    expect(fileContent).toMatchSnapshot();
  });

  describe('api', () => {
    it('should group within an "actions" folder if group is set', async () => {
      const tree = await schematicRunner.runSchematic(
        'action',
        {
          ...defaultOptions,
          group: true,
        },
        appTree
      );
      expect(
        tree.files.includes(`${projectPath}/src/app/actions/foo.actions.ts`)
      ).toBeTruthy();
    });

    it('should create api actions', async () => {
      const tree = await schematicRunner.runSchematic(
        'action',
        {
          ...defaultOptions,
          api: true,
        },
        appTree
      );
      const fileContent = tree.readContent(
        `${projectPath}/src/app/foo.actions.ts`
      );

      expect(fileContent).toMatchSnapshot();
    });
  });
});
