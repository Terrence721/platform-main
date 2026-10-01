import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';

describe('Store Migration 15_2_0', () => {
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/store/migrations/migration.json'
  );
  const pkgName = 'store';

  it(`should replace remove the State type argument`, async () => {
    const input = `
    import {createFeature} from '@ngrx/store';
    interface AppState {
      users: State;
    }
    export const usersFeature = createFeature<AppState>({
      name: 'users',
      reducer: createReducer(initialState, /* case reducers */),
    });
`;

    const expected = `
    import {createFeature} from '@ngrx/store';
    interface AppState {
      users: State;
    }
    export const usersFeature = createFeature({
      name: 'users',
      reducer: createReducer(initialState, /* case reducers */),
    });
`;
    const appTree = new UnitTestTree(Tree.empty());
    appTree.create('./fixture.ts', input);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-15-2-0`,
      {},
      appTree
    );
    const file = newTree.readContent('fixture.ts');

    expect(file).toBe(expected);
  });

  it(`should not update createFeature when correctly used`, async () => {
    const input = `
    import {createFeature} from '@ngrx/store';
    export const usersFeature = createFeature({
      name: 'users',
      reducer: createReducer(initialState, /* case reducers */),
    });
`;

    const appTree = new UnitTestTree(Tree.empty());
    appTree.create('./fixture.ts', input);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-15-2-0`,
      {},
      appTree
    );
    const file = newTree.readContent('fixture.ts');

    expect(file).toBe(input);
  });

  const verify = async (input: string, output: string) => {
    const appTree = new UnitTestTree(Tree.empty());
    appTree.create('./fixture.ts', input);
    const runner = new SchematicTestRunner('schematics', collectionPath);
    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-15-2-0`,
      {},
      appTree
    );
    expect(newTree.readContent('fixture.ts')).toBe(output);
  };

  it('should remove type arguments with a space or line break before >', async () => {
    const imp = `import { createFeature } from '@ngrx/store';\n`;
    await verify(
      imp +
        `const a = createFeature<AppState >({ name: 'a', reducer });\nconst b = createFeature<\n  AppState\n>({ name: 'b', reducer });\n`,
      imp +
        `const a = createFeature({ name: 'a', reducer });\nconst b = createFeature({ name: 'b', reducer });\n`
    );
  });

  it('should migrate aliased and namespace calls', async () => {
    await verify(
      `import { createFeature as cf } from '@ngrx/store';\nimport * as store from '@ngrx/store';\nconst a = cf<AppState>({ name: 'a', reducer });\nconst b = store.createFeature<AppState>({ name: 'b', reducer });\n`,
      `import { createFeature as cf } from '@ngrx/store';\nimport * as store from '@ngrx/store';\nconst a = cf({ name: 'a', reducer });\nconst b = store.createFeature({ name: 'b', reducer });\n`
    );
  });

  it('should leave a createFeature from another module alone', async () => {
    const input = `import { createFeatureSelector } from '@ngrx/store';\nimport { createFeature } from './my-lib';\nconst f = createFeature<Config>({ x: 1 });\n`;
    await verify(input, input);
  });
});
