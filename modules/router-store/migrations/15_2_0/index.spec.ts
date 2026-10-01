import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';
import { waitForAsync } from '@angular/core/testing';

describe('Router Store Migration 15_2_0', () => {
  let appTree: UnitTestTree;
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/router-store/migrations/migration.json'
  );
  const pkgName = 'router-store';

  beforeEach(() => {
    appTree = new UnitTestTree(Tree.empty());
    appTree.create(
      '/tsconfig.json',
      `
        {
          "include": [**./*.ts"]
        }
       `
    );
    createPackageJson('', pkgName, appTree);
  });

  describe('Rename selector', () => {
    it(`renames getSelectors to getRouterSelectors as named imports`, waitForAsync(async () => {
      const input = `
        import { getSelectors } from '@ngrx/router-store';
        export const {
          selectCurrentRoute,
          selectQueryParams,
          selectQueryParam,
          selectRouteParams,
          selectRouteParam,
          selectRouteData,
          selectUrl,
          selectTitle,
        } = getSelectors(selectRouter);
      `;
      const expected = `
        import { getRouterSelectors } from '@ngrx/router-store';
        export const {
          selectCurrentRoute,
          selectQueryParams,
          selectQueryParam,
          selectRouteParams,
          selectRouteParam,
          selectRouteData,
          selectUrl,
          selectTitle,
        } = getRouterSelectors(selectRouter);
      `;

      appTree.create('./selector.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-05`,
        {},
        appTree
      );
      const file = newTree.readContent('selector.ts');

      expect(file).toBe(expected);
    }));

    it(`renames getSelectors to getRouterSelectors as namespace import`, waitForAsync(async () => {
      const input = `
        import * as routerStore from '@ngrx/router-store';
        export const selectors = routerStore.getSelectors(selectRouter);
      `;
      const expected = `
        import * as routerStore from '@ngrx/router-store';
        export const selectors = routerStore.getRouterSelectors(selectRouter);
      `;

      appTree.create('./selector.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-05`,
        {},
        appTree
      );
      const file = newTree.readContent('selector.ts');

      expect(file).toBe(expected);
    }));

    it(`renames getSelectors to getRouterSelectors as namespace import with deconstruct`, waitForAsync(async () => {
      const input = `
        import * as routerStore from '@ngrx/router-store';
        export const {
          selectCurrentRoute,
          selectQueryParams,
          selectQueryParam,
          selectRouteParams,
          selectRouteParam,
          selectRouteData,
          selectUrl,
          selectTitle,
        } = routerStore.getSelectors(selectRouter);
      `;
      const expected = `
        import * as routerStore from '@ngrx/router-store';
        export const {
          selectCurrentRoute,
          selectQueryParams,
          selectQueryParam,
          selectRouteParams,
          selectRouteParam,
          selectRouteData,
          selectUrl,
          selectTitle,
        } = routerStore.getRouterSelectors(selectRouter);
      `;

      appTree.create('./selector.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-05`,
        {},
        appTree
      );
      const file = newTree.readContent('selector.ts');

      expect(file).toBe(expected);
    }));

    it(`does not rename getSelectors if not imported from router-store`, waitForAsync(async () => {
      const input = `
        import { getSelectors } from '@ngrx/something';
        export const { selectCurrentRoute } = getSelectors(selectRouter);
      `;

      appTree.create('./selector.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-05`,
        {},
        appTree
      );
      const file = newTree.readContent('selector.ts');

      expect(file).toBe(input);
    }));
    it(`does not rename other methods on namespace import`, waitForAsync(async () => {
      const input = `
        import * as routerStore from '@ngrx/router-store';
        const root = routerStore.forRoot();
      `;

      appTree.create('./selector.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-05`,
        {},
        appTree
      );
      const file = newTree.readContent('selector.ts');

      expect(file).toBe(input);
    }));
  });

  describe('more import and call forms', () => {
    const verify = async (input: string, output: string) => {
      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-05`,
        {},
        appTree
      );
      expect(newTree.readContent('main.ts')).toBe(output);
    };

    it('should rename an aliased import and keep its local name', async () => {
      await verify(
        `import { getSelectors as gs } from '@ngrx/router-store';\nexport const s = gs(selectRouter);\n`,
        `import { getRouterSelectors as gs } from '@ngrx/router-store';\nexport const s = gs(selectRouter);\n`
      );
    });

    it('should keep a type modifier and rename typeof uses', async () => {
      await verify(
        `import { type getSelectors, routerReducer } from '@ngrx/router-store';\ntype G = typeof getSelectors;\n`,
        `import { type getRouterSelectors, routerReducer } from '@ngrx/router-store';\ntype G = typeof getRouterSelectors;\n`
      );
    });

    it('should rename namespace calls anywhere', async () => {
      await verify(
        `import * as rs from '@ngrx/router-store';\nexport function f() { return rs.getSelectors(selectRouter); }\nexport const a = 1, s = rs.getSelectors(selectRouter);\nexport const url = rs.getSelectors(selectRouter).selectUrl;\n`,
        `import * as rs from '@ngrx/router-store';\nexport function f() { return rs.getRouterSelectors(selectRouter); }\nexport const a = 1, s = rs.getRouterSelectors(selectRouter);\nexport const url = rs.getRouterSelectors(selectRouter).selectUrl;\n`
      );
    });
  });
});
