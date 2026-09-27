import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as SelectorOptions } from './schema';
import {
  getTestProjectPath,
  createWorkspace,
} from '@ngrx/schematics-core/testing';

describe('Selector Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/schematics',
    path.join(process.cwd(), 'dist/modules/schematics/collection.json')
  );
  const defaultOptions: SelectorOptions = {
    name: 'foo',
    project: 'bar',
  };

  const projectPath = getTestProjectPath();

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  describe('without the feature flag', () => {
    it('should create a feature selector and import only what it uses', async () => {
      const tree = await schematicRunner.runSchematic(
        'selector',
        defaultOptions,
        appTree
      );
      const content = tree.readContent(
        `${projectPath}/src/app/foo.selectors.ts`
      );

      expect(content).toContain(
        "import { createFeatureSelector } from '@ngrx/store';"
      );
      expect(content).toContain(
        "export const selectFooState = createFeatureSelector<unknown>('foo');"
      );
      expect(content).not.toContain('createSelector');
    });

    it('should create a spec that tests the selector', async () => {
      const tree = await schematicRunner.runSchematic(
        'selector',
        defaultOptions,
        appTree
      );
      const spec = tree
        .readContent(`${projectPath}/src/app/foo.selectors.spec.ts`)
        .replace(/\r\n/g, '\n');

      expect(spec).toContain(
        "import { selectFooState } from './foo.selectors';"
      );
      expect(spec).toContain('expect(result).toEqual({});');
      expect(spec).not.toMatch(/^[ \t]+$/m);
    });
  });

  it('should not import createSelector with the feature flag either', async () => {
    const tree = await schematicRunner.runSchematic(
      'selector',
      { ...defaultOptions, feature: true },
      appTree
    );

    expect(
      tree.readContent(`${projectPath}/src/app/foo.selectors.ts`)
    ).not.toContain('createSelector');
  });

  it('should fail with a validation error if the name is missing', async () => {
    await expect(
      schematicRunner.runSchematic('selector', { project: 'bar' }, appTree)
    ).rejects.toThrow("must have required property 'name'");
  });

  it('should create selector files', async () => {
    const tree = await schematicRunner.runSchematic(
      'selector',
      defaultOptions,
      appTree
    );

    const selectorPath = `${projectPath}/src/app/foo.selectors.ts`;
    const specPath = `${projectPath}/src/app/foo.selectors.spec.ts`;

    expect(tree.files.includes(selectorPath)).toBeTruthy();
    expect(tree.files.includes(specPath)).toBeTruthy();

    expect(tree.readContent(selectorPath)).toMatchSnapshot();
    expect(tree.readContent(specPath)).toMatchSnapshot();
  });

  it('should not create a spec file if spec is false', async () => {
    const options = {
      ...defaultOptions,
      skipTests: true,
    };
    const tree = await schematicRunner.runSchematic(
      'selector',
      options,
      appTree
    );

    expect(
      tree.files.includes(`${projectPath}/src/app/foo.selectors.spec.ts`)
    ).toBeFalsy();
  });

  it('should group selectors if group is true', async () => {
    const options = {
      ...defaultOptions,
      group: true,
    };
    const tree = await schematicRunner.runSchematic(
      'selector',
      options,
      appTree
    );

    const selectorPath = `${projectPath}/src/app/selectors/foo.selectors.ts`;
    const specPath = `${projectPath}/src/app/selectors/foo.selectors.spec.ts`;

    expect(tree.files.includes(selectorPath)).toBeTruthy();
    expect(tree.files.includes(specPath)).toBeTruthy();

    expect(tree.readContent(selectorPath)).toMatchSnapshot();
    expect(tree.readContent(specPath)).toMatchSnapshot();
  });

  it('should not flatten selectors if flat is false', async () => {
    const options = {
      ...defaultOptions,
      flat: false,
    };
    const tree = await schematicRunner.runSchematic(
      'selector',
      options,
      appTree
    );

    const selectorPath = `${projectPath}/src/app/foo/foo.selectors.ts`;
    const specPath = `${projectPath}/src/app/foo/foo.selectors.spec.ts`;

    expect(tree.files.includes(selectorPath)).toBeTruthy();
    expect(tree.files.includes(specPath)).toBeTruthy();

    expect(tree.readContent(selectorPath)).toMatchSnapshot();
    expect(tree.readContent(specPath)).toMatchSnapshot();
  });

  describe('With feature flag', () => {
    it('should create a selector', async () => {
      const options = {
        ...defaultOptions,
        feature: true,
      };

      const tree = await schematicRunner.runSchematic(
        'selector',
        options,
        appTree
      );

      const selectorPath = `${projectPath}/src/app/foo.selectors.ts`;
      const specPath = `${projectPath}/src/app/foo.selectors.spec.ts`;

      expect(tree.files.includes(selectorPath)).toBeTruthy();
      expect(tree.files.includes(specPath)).toBeTruthy();

      expect(tree.readContent(selectorPath)).toMatchSnapshot();
      expect(tree.readContent(specPath)).toMatchSnapshot();
    });

    it('should group and nest the selectors within a feature', async () => {
      const options = {
        ...defaultOptions,
        feature: true,
        group: true,
        flat: false,
      };

      const tree = await schematicRunner.runSchematic(
        'selector',
        options,
        appTree
      );
      const selectorPath = `${projectPath}/src/app/selectors/foo/foo.selectors.ts`;
      const specPath = `${projectPath}/src/app/selectors/foo/foo.selectors.spec.ts`;

      expect(tree.files.includes(selectorPath)).toBeTruthy();
      expect(tree.files.includes(specPath)).toBeTruthy();

      expect(tree.readContent(selectorPath)).toMatchSnapshot();
      expect(tree.readContent(specPath)).toMatchSnapshot();
    });
  });
});
