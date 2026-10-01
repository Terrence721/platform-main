import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';

describe('Store Migration 16_0_0-beta', () => {
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/store/migrations/migration.json'
  );

  it(`should replace getMockStore with createMockStore`, async () => {
    const input = `
    import { getMockStore } from '@ngrx/store';
    import { SomethingElse } from '@ngrx/store';
    import {getMockStore} from '@ngrx/store';
    import {foo, getMockStore, bar} from '@ngrx/store';

    const mockStore = getMockStore();

    it('just a test', () => {
      const s =getMockStore();
    })
`;

    const expected = `
    import { createMockStore } from '@ngrx/store';
    import { SomethingElse } from '@ngrx/store';
    import {createMockStore} from '@ngrx/store';
    import {foo, createMockStore, bar} from '@ngrx/store';

    const mockStore = createMockStore();

    it('just a test', () => {
      const s =createMockStore();
    })
`;
    const appTree = new UnitTestTree(Tree.empty());
    appTree.create('./fixture.ts', input);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-store-migration-16-0-0-beta`,
      {},
      appTree
    );
    const file = newTree.readContent('fixture.ts');

    expect(file).toBe(expected);
  });

  const verify = async (input: string, output: string) => {
    const appTree = new UnitTestTree(Tree.empty());
    appTree.create('./fixture.ts', input);
    const runner = new SchematicTestRunner('schematics', collectionPath);
    const newTree = await runner.runSchematic(
      `ngrx-store-migration-16-0-0-beta`,
      {},
      appTree
    );
    expect(newTree.readContent('fixture.ts')).toBe(output);
  };

  it('should migrate the @ngrx/store/testing import', async () => {
    await verify(
      `import { getMockStore, MockStore } from '@ngrx/store/testing';\nconst store: MockStore = getMockStore({ initialState });\n`,
      `import { createMockStore, MockStore } from '@ngrx/store/testing';\nconst store: MockStore = createMockStore({ initialState });\n`
    );
  });

  it('should keep an alias and rename other references', async () => {
    await verify(
      `import { getMockStore as gms } from '@ngrx/store/testing';\nconst s = gms();\n`,
      `import { createMockStore as gms } from '@ngrx/store/testing';\nconst s = gms();\n`
    );
    await verify(
      `import { getMockStore } from '@ngrx/store/testing';\nconst factory = getMockStore;\n`,
      `import { createMockStore } from '@ngrx/store/testing';\nconst factory = createMockStore;\n`
    );
  });

  it('should migrate uses through a namespace import', async () => {
    await verify(
      `import * as testing from '@ngrx/store/testing';\nconst s = testing.getMockStore();\n`,
      `import * as testing from '@ngrx/store/testing';\nconst s = testing.createMockStore();\n`
    );
  });

  it('should leave a getMockStore from another module alone', async () => {
    const input = `import { getMockStore } from './my-testing';\nconst s = getMockStore();\n`;
    await verify(input, input);
  });
});
