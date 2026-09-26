import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as fs from 'fs';
import * as path from 'path';
import { Schema as ContainerOptions } from './schema';
import {
  getTestProjectPath,
  createWorkspace,
} from '@ngrx/schematics-core/testing';

describe('Container Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/schematics',
    path.join(process.cwd(), 'dist/modules/schematics/collection.json')
  );

  const defaultOptions: ContainerOptions = {
    name: 'foo',
    project: 'bar',
    inlineStyle: false,
    inlineTemplate: false,
    style: 'css',
    module: undefined,
    export: false,
    prefix: 'app',
  };

  const projectPath = getTestProjectPath();

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  it('should respect the state option if not provided', async () => {
    const options = { ...defaultOptions, state: undefined };
    const tree = await schematicRunner.runSchematic(
      'container',
      options,
      appTree
    );
    const content = tree.readContent(`${projectPath}/src/app/foo/foo.ts`);
    expect(content).not.toMatch(/fromStore/);
    expect(content).toMatchSnapshot();
  });

  it('should put the constructor on its own line, with the closing brace on the next', async () => {
    const options = { ...defaultOptions, state: undefined };
    const tree = await schematicRunner.runSchematic(
      'container',
      options,
      appTree
    );
    const content = tree.readContent(`${projectPath}/src/app/foo/foo.ts`);
    // Deliberately not a snapshot: this has to hold however @schematics/angular
    // lays out the empty class it generates (one or two line terminators
    // between the braces), and `vitest -u` must not be able to bless a
    // `constructor(...) {}}` result.
    expect(content).toMatch(
      /\{\n {2}constructor\(private store: Store\) \{\}\r?\n\}/
    );
  });

  it('should remove .ts from the state path if provided', async () => {
    const options = { ...defaultOptions, state: 'reducers/foo.ts' };
    appTree.create(`${projectPath}/src/app/reducers/foo.ts`, '');
    const tree = await schematicRunner.runSchematic(
      'container',
      options,
      appTree
    );
    expect(tree.readContent(`${projectPath}/src/app/foo/foo.ts`)).toContain(
      "import * as fromStore from '../reducers/foo';"
    );
  });

  it('should remove index.ts from the state path if provided', async () => {
    const options = { ...defaultOptions, state: 'reducers/index.ts' };
    appTree.create(`${projectPath}/src/app/reducers/index.ts`, '');
    const tree = await schematicRunner.runSchematic(
      'container',
      options,
      appTree
    );
    expect(tree.readContent(`${projectPath}/src/app/foo/foo.ts`)).toContain(
      "import * as fromStore from '../reducers';"
    );
  });

  it('should import Store into the component', async () => {
    const options = { ...defaultOptions, state: 'reducers' };
    appTree.create(`${projectPath}/src/app/reducers`, '');
    const tree = await schematicRunner.runSchematic(
      'container',
      options,
      appTree
    );
    const content = tree.readContent(`${projectPath}/src/app/foo/foo.ts`);
    expect(content).toMatch(/Store/);
    expect(content).toMatchSnapshot();
  });

  describe('stateInterface', () => {
    const generateWithState = async (options: Partial<ContainerOptions>) => {
      appTree.create(
        `${projectPath}/src/app/reducers/index.ts`,
        'export interface State {}\nexport interface AppState {}\n'
      );
      const tree = await schematicRunner.runSchematic(
        'container',
        { ...defaultOptions, ...options },
        appTree
      );

      return tree.readContent(`${projectPath}/src/app/foo/foo.ts`);
    };

    it('should type the store with the default State interface of the state file', async () => {
      const content = await generateWithState({ state: 'reducers/index.ts' });

      expect(content).toContain(
        'constructor(private store: Store<fromStore.State>) {}'
      );
    });

    it('should type the store with the given interface of the state file', async () => {
      const content = await generateWithState({
        state: 'reducers/index.ts',
        stateInterface: 'AppState',
      });

      expect(content).toContain(
        'constructor(private store: Store<fromStore.AppState>) {}'
      );
    });

    it('should leave the store untyped without a state file', async () => {
      const content = await generateWithState({ stateInterface: 'AppState' });

      expect(content).toContain('constructor(private store: Store) {}');
      expect(content).not.toMatch(/fromStore/);
    });
  });

  it('should update the component spec', async () => {
    const options: ContainerOptions = { ...defaultOptions, testDepth: 'unit' };
    const tree = await schematicRunner.runSchematic(
      'container',
      options,
      appTree
    );
    const content = tree.readContent(`${projectPath}/src/app/foo/foo.spec.ts`);
    expect(content).toContain("import { Foo } from './foo';");
    expect(content).toContain('store = TestBed.inject(MockStore);');
    expect(content).toMatchSnapshot();
  });

  it('should use StoreModule if integration test', async () => {
    const options = { ...defaultOptions };
    const tree = await schematicRunner.runSchematic(
      'container',
      options,
      appTree
    );
    const content = tree.readContent(`${projectPath}/src/app/foo/foo.spec.ts`);
    expect(content).toContain("import { Foo } from './foo';");
    expect(content).toContain('imports: [StoreModule.forRoot({}), Foo],');
    expect(content).toMatchSnapshot();
  });

  describe('component spec', () => {
    const generate = async (options: Partial<ContainerOptions>) => {
      const tree = await schematicRunner.runSchematic(
        'container',
        { ...defaultOptions, ...options },
        appTree
      );

      return tree;
    };
    // `readContent` returns '' for a missing file, which would let the
    // `not.toMatch` assertions below pass without reading anything.
    const readSpec = (tree: UnitTestTree) => {
      const file = `${projectPath}/src/app/foo/foo.spec.ts`;
      expect(tree.exists(file)).toBe(true);

      return tree.readContent(file).replace(/\r\n/g, '\n');
    };

    it('should sit next to the component and import it by its generated names', async () => {
      const tree = await generate({});

      expect(tree.exists(`${projectPath}/src/app/foo/foo.ts`)).toBe(true);
      expect(tree.files.filter((file) => file.endsWith('.spec.ts'))).toContain(
        `${projectPath}/src/app/foo/foo.spec.ts`
      );
      expect(
        tree.files.some((file) => file.endsWith('foo-component.spec.ts'))
      ).toBe(false);
    });

    it('should not use Jasmine globals, which the default Vitest runner does not have', async () => {
      const spec = readSpec(await generate({}));

      expect(spec).not.toMatch(/\bspyOn\(/);
    });

    it.each(['unit', 'integration'] as const)(
      'should declare a non-standalone component instead of importing it (%s)',
      async (testDepth) => {
        const spec = readSpec(await generate({ standalone: false, testDepth }));

        expect(spec).toContain('declarations: [Foo],');
        expect(spec).not.toMatch(/imports: \[[^\]]*\bFoo\]/);
      }
    );

    it.each([
      ['unit', true],
      ['unit', false],
      ['integration', true],
      ['integration', false],
    ] as const)(
      'should not leave blank or whitespace-only lines (%s, standalone: %s)',
      async (testDepth, standalone) => {
        const spec = readSpec(await generate({ testDepth, standalone }));

        expect(spec).not.toMatch(/^[ \t]+$/m);
        expect(spec).not.toMatch(/configureTestingModule\(\{\n\s*\n/);
      }
    );

    it('should not create a spec if skipTests is set', async () => {
      const tree = await generate({ skipTests: true });

      expect(
        tree.files.filter((file) => file.endsWith('.spec.ts'))
      ).not.toContain(`${projectPath}/src/app/foo/foo.spec.ts`);
    });
  });

  describe('schema', () => {
    const generate = (options: Partial<ContainerOptions>) =>
      schematicRunner.runSchematic(
        'container',
        { ...defaultOptions, ...options },
        appTree
      );

    it('should fail with a validation error if the name is missing', async () => {
      await expect(
        schematicRunner.runSchematic('container', { project: 'bar' }, appTree)
      ).rejects.toThrow("must have required property 'name'");
    });

    it('should accept the ShadowDom view encapsulation', async () => {
      const tree = await generate({ viewEncapsulation: 'ShadowDom' });

      expect(tree.readContent(`${projectPath}/src/app/foo/foo.ts`)).toContain(
        'encapsulation: ViewEncapsulation.ShadowDom'
      );
    });

    it('should only offer the view encapsulations Angular accepts', () => {
      const own = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8')
      );
      const angular = JSON.parse(
        fs.readFileSync(
          path.join(
            process.cwd(),
            'node_modules/@schematics/angular/component/schema.json'
          ),
          'utf8'
        )
      );

      expect(own.properties.viewEncapsulation.enum).toEqual(
        angular.properties.viewEncapsulation.enum
      );
    });

    it('should not give two options the same alias', () => {
      // The CLI merges options that share an alias: `-p app` would set both
      // `project` and `prefix`.
      const schema = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8')
      ) as {
        properties: Record<string, { alias?: string; aliases?: string[] }>;
      };
      const aliases = Object.values(schema.properties).flatMap(
        ({ alias, aliases = [] }) => (alias ? [alias, ...aliases] : aliases)
      );

      expect(aliases).toEqual([...new Set(aliases)]);
    });
  });

  describe('standalone', () => {
    it('should be standalone by default', async () => {
      const options = { ...defaultOptions };
      const tree = await schematicRunner.runSchematic(
        'container',
        options,
        appTree
      );
      const content = tree.readContent(`${projectPath}/src/app/foo/foo.ts`);
      expect(content).not.toMatch(/standalone/);
      expect(content).toMatchSnapshot();
    });

    it('should create a non-standalone component if false', async () => {
      const options = { ...defaultOptions, standalone: false };
      const tree = await schematicRunner.runSchematic(
        'container',
        options,
        appTree
      );
      const content = tree.readContent(`${projectPath}/src/app/foo/foo.ts`);
      expect(content).toMatch(/standalone: false/);
      expect(content).toMatchSnapshot();
    });
  });

  describe('display-block', () => {
    it('should be disabled by default', async () => {
      const options = { ...defaultOptions };
      const tree = await schematicRunner.runSchematic(
        'container',
        options,
        appTree
      );
      const content = tree.readContent(`${projectPath}/src/app/foo/foo.css`);
      expect(content).not.toMatch(/display: block/);
      expect(content).toMatchSnapshot();
    });

    it('should create add style if true', async () => {
      const options = { ...defaultOptions, displayBlock: true };
      const tree = await schematicRunner.runSchematic(
        'container',
        options,
        appTree
      );
      const content = tree.readContent(`${projectPath}/src/app/foo/foo.css`);
      expect(content).toMatch(/display: block/);
      expect(content).toMatchSnapshot();
    });
  });
});
