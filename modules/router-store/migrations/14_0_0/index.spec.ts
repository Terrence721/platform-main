import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';
import { waitForAsync } from '@angular/core/testing';

describe('Router Store Migration 14_0_0', () => {
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

  describe('Rename serializers', () => {
    it(`should rename the DefaultRouterStateSerializer to FullRouterStateSerializer`, waitForAsync(async () => {
      const input = `
      import { DefaultRouterStateSerializer } from '@ngrx/router-store';

      const fullSerializer: DefaultRouterStateSerializer;

      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot({ serializer: DefaultRouterStateSerializer, key: 'router' }),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { FullRouterStateSerializer } from '@ngrx/router-store';

      const fullSerializer: FullRouterStateSerializer;

      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot({ serializer: FullRouterStateSerializer, key: 'router' }),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-04`,
        {},
        appTree
      );
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));
  });

  describe('every reference', () => {
    const imp = `import { DefaultRouterStateSerializer } from '@ngrx/router-store';\n`;
    const newImp = `import { FullRouterStateSerializer } from '@ngrx/router-store';\n`;

    const verify = async (input: string, output: string) => {
      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-04`,
        {},
        appTree
      );
      expect(newTree.readContent('main.ts')).toBe(output);
    };

    it('should rename extends, new and type references', async () => {
      await verify(
        imp +
          `export class S extends DefaultRouterStateSerializer {}\nconst s = new DefaultRouterStateSerializer();\nfunction f(s: DefaultRouterStateSerializer) {}\n`,
        newImp +
          `export class S extends FullRouterStateSerializer {}\nconst s = new FullRouterStateSerializer();\nfunction f(s: FullRouterStateSerializer) {}\n`
      );
    });

    it('should keep a type modifier', async () => {
      await verify(
        `import { type DefaultRouterStateSerializer, routerReducer } from '@ngrx/router-store';\nlet s: DefaultRouterStateSerializer;\n`,
        `import { type FullRouterStateSerializer, routerReducer } from '@ngrx/router-store';\nlet s: FullRouterStateSerializer;\n`
      );
    });

    it('should rename uses through a namespace import', async () => {
      await verify(
        `import * as rs from '@ngrx/router-store';\nconst p = { useClass: rs.DefaultRouterStateSerializer };\nlet s: rs.DefaultRouterStateSerializer;\n`,
        `import * as rs from '@ngrx/router-store';\nconst p = { useClass: rs.FullRouterStateSerializer };\nlet s: rs.FullRouterStateSerializer;\n`
      );
    });

    it('should leave object keys and other properties alone', async () => {
      await verify(
        imp +
          `const o = { DefaultRouterStateSerializer: 1 };\nconst x = foo.DefaultRouterStateSerializer;\n`,
        newImp +
          `const o = { DefaultRouterStateSerializer: 1 };\nconst x = foo.DefaultRouterStateSerializer;\n`
      );
    });
  });
});
