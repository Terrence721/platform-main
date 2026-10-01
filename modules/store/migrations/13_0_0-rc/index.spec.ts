import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';

describe('Store Migration 13_0_1', () => {
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/store/migrations/migration.json'
  );
  const pkgName = 'store';

  it(`should replace createSelector with explicit generics usages with explicit generics using Slices tuple`, async () => {
    const contents = `
import {createSelector} from '@ngrx/store'

// untouched
const selectorWithoutGenericArgs = createSelector(() => 1, a => a);
const selectorWithPropsWithGenericArgs = createSelector<State, number, number, number>(() => 1, (a, b) => a + b);

// modified
const selectorWithOneSliceWithGenericArgs = createSelector<State,number,string>(() => 1, a => a);
const selectorWithTwoSlicesWithGenericArgs = createSelector<State,number,string,number>(() => 1, () => '2', (a, b) => a + b);
const selectorWithOneSliceWithGenericArgsWithWhitespace = createSelector<State, number, string>(() => 1, a => a);
const selectorWithTwoSlicesWithGenericArgsWithWhitespace = createSelector<State,  number, string, number>(() => 1, () => '2', (a, b) => a + b);
`;

    const expected = `
import {createSelector} from '@ngrx/store'

// untouched
const selectorWithoutGenericArgs = createSelector(() => 1, a => a);
const selectorWithPropsWithGenericArgs = createSelector<State, number, number, number>(() => 1, (a, b) => a + b);

// modified
const selectorWithOneSliceWithGenericArgs = createSelector<State,[number],string>(() => 1, a => a);
const selectorWithTwoSlicesWithGenericArgs = createSelector<State,[number,string],number>(() => 1, () => '2', (a, b) => a + b);
const selectorWithOneSliceWithGenericArgsWithWhitespace = createSelector<State, [number], string>(() => 1, a => a);
const selectorWithTwoSlicesWithGenericArgsWithWhitespace = createSelector<State,  [number, string], number>(() => 1, () => '2', (a, b) => a + b);
`;
    const appTree = new UnitTestTree(Tree.empty());
    appTree.create('./fixture.ts', contents);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-13-rc`,
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
      `ngrx-${pkgName}-migration-13-rc`,
      {},
      appTree
    );
    expect(newTree.readContent('fixture.ts')).toBe(output);
  };

  it('should keep line breaks and comments in the generics', async () => {
    await verify(
      `import { createSelector } from '@ngrx/store';\nconst s = createSelector<\n  State,\n  number, // count\n  string,\n  number\n>(a, b, (x, y) => x);\n`,
      `import { createSelector } from '@ngrx/store';\nconst s = createSelector<\n  State,\n  [number, // count\n  string],\n  number\n>(a, b, (x, y) => x);\n`
    );
  });

  it('should migrate aliased and namespace calls', async () => {
    await verify(
      `import { createSelector as cs } from '@ngrx/store';\nimport * as store from '@ngrx/store';\nconst a = cs<State, number, string>(s1, (x) => 'a');\nconst b = store.createSelector<State, number, string>(s1, (x) => 'b');\n`,
      `import { createSelector as cs } from '@ngrx/store';\nimport * as store from '@ngrx/store';\nconst a = cs<State, [number], string>(s1, (x) => 'a');\nconst b = store.createSelector<State, [number], string>(s1, (x) => 'b');\n`
    );
  });

  it('should leave a createSelector from another module alone', async () => {
    const input = `import { createSelector } from 'reselect';\nconst s = createSelector<State, number, string>(s1, (x) => 'a');\n`;
    await verify(input, input);
  });
});
